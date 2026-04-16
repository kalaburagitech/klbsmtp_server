const express = require("express");
const apiKeyAuth = require("../../middleware/apiKeyAuth");
const asyncHandler = require("../../utils/asyncHandler");
const prisma = require("../../config/prisma");
const { getTodayEmailCount } = require("../../services/limitService");

const router = express.Router();

/**
 * @swagger
 * /org/dashboard:
 *   get:
 *     summary: Organization dashboard statistics
 *     tags: [Organization]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Organization scoped dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     status: { type: string }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalEmails: { type: integer, example: 120 }
 *                     todayEmails: { type: integer, example: 18 }
 *                     dailyLimit: { type: integer, example: 100 }
 */
router.get(
  "/dashboard",
  apiKeyAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.org.id;
    const [totalEmails, todayEmails] = await Promise.all([
      prisma.emailLog.count({ where: { orgId } }),
      getTodayEmailCount(orgId)
    ]);

    res.json({
      organization: {
        id: req.org.id,
        name: req.org.name,
        status: req.org.status
      },
      stats: {
        totalEmails,
        todayEmails,
        dailyLimit: req.org.dailyLimit
      }
    });
  })
);

module.exports = router;
