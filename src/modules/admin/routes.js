const express = require("express");
const Joi = require("joi");
const prisma = require("../../config/prisma");
const authJwt = require("../../middleware/authJwt");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const { loginAdmin } = require("../../services/adminService");
const { createOrganization, listOrganizations } = require("../../services/organizationService");
const { getTodayUtcDate } = require("../../services/limitService");

const router = express.Router();

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const createOrgSchema = Joi.object({
  name: Joi.string().min(2).required(),
  dailyLimit: Joi.number().integer().min(1).max(100000).default(100),
  status: Joi.string().valid("active", "inactive").default("active")
});

/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string, format: email }
 *                     role: { type: string }
 */
router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginAdmin(req.body);
    res.json(result);
  })
);

/**
 * @swagger
 * /admin/create-org:
 *   post:
 *     summary: Create organization
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               dailyLimit: { type: integer, example: 100 }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       201:
 *         description: Organization created
 */
router.post(
  "/create-org",
  authJwt,
  validate(createOrgSchema),
  asyncHandler(async (req, res) => {
    const org = await createOrganization(req.body);
    res.status(201).json(org);
  })
);

/**
 * @swagger
 * /admin/orgs:
 *   get:
 *     summary: List organizations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organizations
 */
router.get(
  "/orgs",
  authJwt,
  asyncHandler(async (req, res) => {
    const organizations = await listOrganizations();
    res.json(organizations);
  })
);

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: List all email logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All logs across organizations
 */
router.get(
  "/logs",
  authJwt,
  asyncHandler(async (req, res) => {
    const logs = await prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { organization: { select: { name: true } } }
    });
    const emailsSentToday = await prisma.emailDailyCount.aggregate({
      _sum: { sentCount: true },
      where: { date: getTodayUtcDate() }
    });
    res.json({
      emailsSentToday: emailsSentToday._sum.sentCount || 0,
      logs
    });
  })
);

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Dashboard stats
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/stats",
  authJwt,
  asyncHandler(async (req, res) => {
    const [totalOrgs, sentToday] = await Promise.all([
      prisma.organization.count(),
      prisma.emailDailyCount.aggregate({
        _sum: { sentCount: true },
        where: { date: getTodayUtcDate() }
      })
    ]);
    res.json({ totalOrgs, emailsSentToday: sentToday._sum.sentCount || 0 });
  })
);

module.exports = router;
