const express = require("express");
const Joi = require("joi");
const validate = require("../../middleware/validate");
const apiKeyAuth = require("../../middleware/apiKeyAuth");
const asyncHandler = require("../../utils/asyncHandler");
const { queueEmails, getOrganizationLogs } = require("../../services/emailJobService");
const { getTodayEmailCount } = require("../../services/limitService");

const router = express.Router();

const attachmentSchema = Joi.object({
  filename: Joi.string().required(),
  content: Joi.string().required(),
  encoding: Joi.string().valid("base64").default("base64"),
  contentType: Joi.string().optional()
});

const sendSchema = Joi.object({
  to: Joi.string().email(),
  subject: Joi.string(),
  html: Joi.string(),
  attachments: Joi.array().items(attachmentSchema),
  emails: Joi.array().items(
    Joi.object({
      to: Joi.string().email().required(),
      subject: Joi.string().required(),
      html: Joi.string().required(),
      attachments: Joi.array().items(attachmentSchema)
    })
  )
})
  .or("emails", "to")
  .custom((value, helpers) => {
    if (!value.emails && (!value.subject || !value.html)) {
      return helpers.error("any.invalid");
    }
    return value;
  }, "single email fields");

/**
 * @swagger
 * /email/send:
 *   post:
 *     summary: Queue single or multiple emails
 *     tags: [Email]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [to, subject, html]
 *                 properties:
 *                   to: { type: string, format: email }
 *                   subject: { type: string }
 *                   html: { type: string }
 *               - type: object
 *                 required: [emails]
 *                 properties:
 *                   emails:
 *                     type: array
 *                     items:
 *                       type: object
 *                       required: [to, subject, html]
 *                       properties:
 *                         to: { type: string, format: email }
 *                         subject: { type: string }
 *                         html: { type: string }
 *     responses:
 *       200:
 *         description: Emails accepted to queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Emails queued }
 *                 warning:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 queued: { type: integer, example: 1 }
 *       403:
 *         description: Limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: Daily limit reached (100 emails). Sending blocked. }
 */
router.post(
  "/send",
  apiKeyAuth,
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const result = await queueEmails(req.org, req.body);
    if (!result.allowed) {
      return res.status(403).json({ error: result.message });
    }
    return res.status(200).json({
      message: "Emails queued",
      warning: result.warning ? result.warningMessage : null,
      queued: result.queued
    });
  })
);

/**
 * @swagger
 * /email/logs:
 *   get:
 *     summary: Get logs by API key organization
 *     tags: [Email]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Organization scoped logs and usage
 */
router.get(
  "/logs",
  apiKeyAuth,
  asyncHandler(async (req, res) => {
    const logs = await getOrganizationLogs(req.org.id);
    const sentToday = await getTodayEmailCount(req.org.id);
    res.json({
      organization: {
        id: req.org.id,
        name: req.org.name,
        dailyLimit: req.org.dailyLimit,
        status: req.org.status
      },
      usage: {
        sentToday,
        remainingToday: Math.max(req.org.dailyLimit - sentToday, 0),
        dailyLimit: req.org.dailyLimit
      },
      logs
    });
  })
);

module.exports = router;
