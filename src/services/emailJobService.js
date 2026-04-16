const Joi = require("joi");
const prisma = require("../config/prisma");
const { emailQueue } = require("../queue/emailQueue");
const { checkEmailLimit } = require("./limitService");

const emailItemSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().required(),
  html: Joi.string().required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        filename: Joi.string().required(),
        content: Joi.string().required(),
        encoding: Joi.string().valid("base64").default("base64"),
        contentType: Joi.string().optional()
      })
    )
    .optional()
});

function dedupeEmails(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item.to).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function queueEmails(organization, payload) {
  const normalizedItems = Array.isArray(payload.emails)
    ? payload.emails
    : [{ to: payload.to, subject: payload.subject, html: payload.html, attachments: payload.attachments || [] }];

  const validated = normalizedItems.map((item) => {
    const { error, value } = emailItemSchema.validate(item);
    if (error) {
      const err = new Error(`Invalid email payload: ${error.message}`);
      err.status = 400;
      throw err;
    }
    return value;
  });

  const deduped = dedupeEmails(validated);
  const limitCheck = await checkEmailLimit(organization.id, deduped.length, {
    dailyLimit: organization.dailyLimit
  });

  if (!limitCheck.allowed) {
    return {
      allowed: false,
      warning: false,
      message: limitCheck.message,
      queued: 0,
      deduplicatedFrom: validated.length
    };
  }

  await Promise.all(
    deduped.map((item) =>
      emailQueue.add("send-email", {
        organizationId: organization.id,
        to: item.to,
        subject: item.subject,
        html: item.html,
        attachments: item.attachments || []
      })
    )
  );

  return {
    allowed: true,
    queued: deduped.length,
    deduplicatedFrom: validated.length,
    warning: limitCheck.warning,
    warningMessage: limitCheck.warning ? limitCheck.message : ""
  };
}

async function getOrganizationLogs(organizationId) {
  const logs = await prisma.emailLog.findMany({
    where: { orgId: organizationId },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return logs;
}

module.exports = { queueEmails, getOrganizationLogs };
