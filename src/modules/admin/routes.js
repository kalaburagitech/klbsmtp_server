const express = require("express");
const Joi = require("joi");
const prisma = require("../../config/prisma");
const authJwt = require("../../middleware/authJwt");
const validate = require("../../middleware/validate");
const asyncHandler = require("../../utils/asyncHandler");
const { loginAdmin } = require("../../services/adminService");
const {
  createOrganization,
  listOrganizations,
  updateOrganizationControls
} = require("../../services/organizationService");
const { getTodayDateRange } = require("../../services/limitService");

const router = express.Router();

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const createOrgSchema = Joi.object({
  name: Joi.string().min(2).required(),
  contactName: Joi.string().min(2).required(),
  contactEmail: Joi.string().email().required(),
  dailyLimit: Joi.number().integer().min(1).max(100000).default(100),
  status: Joi.string().valid("active", "inactive").default("active")
});

const orgControlSchema = Joi.object({
  isBlocked: Joi.boolean().optional(),
  allowOverLimitOverride: Joi.boolean().optional()
}).or("isBlocked", "allowOverLimitOverride");

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
 *               contactName: { type: string }
 *               contactEmail: { type: string, format: email }
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
    const organizations = await listOrganizations({
      status: req.query.status,
      blocked:
        typeof req.query.blocked === "string"
          ? req.query.blocked.toLowerCase() === "true"
          : undefined,
      search: req.query.search
    });
    res.json(organizations);
  })
);

router.patch(
  "/orgs/:id/controls",
  authJwt,
  validate(orgControlSchema),
  asyncHandler(async (req, res) => {
    const updated = await updateOrganizationControls(req.params.id, req.body);
    res.json(updated);
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
    const where = {};
    if (req.query.orgId) where.orgId = req.query.orgId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.email) {
      where.email = { contains: req.query.email, mode: "insensitive" };
    }
    if (req.query.from || req.query.to) {
      where.timestamp = {};
      if (req.query.from) where.timestamp.gte = new Date(req.query.from);
      if (req.query.to) where.timestamp.lte = new Date(req.query.to);
    }

    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { organization: { select: { name: true } } }
    });

    const { start, end } = getTodayDateRange();
    const emailsSentToday = await prisma.emailDailyCount.aggregate({
      _sum: { sentCount: true },
      where: { date: { gte: start, lt: end } }
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
    const { start, end } = getTodayDateRange();
    const [totalOrgs, blockedOrgs, sentToday] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { isBlocked: true } }),
      prisma.emailDailyCount.aggregate({
        _sum: { sentCount: true },
        where: { date: { gte: start, lt: end } }
      })
    ]);
    res.json({
      totalOrgs,
      blockedOrgs,
      emailsSentToday: sentToday._sum.sentCount || 0
    });
  })
);

module.exports = router;
