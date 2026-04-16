const Joi = require("joi");
const prisma = require("../config/prisma");
const { emailQueue } = require("../queue/emailQueue");
const { checkEmailLimit } = require("./limitService");
const { sendEmail } = require("./emailService");
const env = require("../config/env");

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

async function sendUsageAlertEmail(organization, kind, usage) {
  if (!organization.contactEmail) return;

  const subject =
    kind === "full"
      ? `[${organization.name}] Daily email limit reached`
      : `[${organization.name}] 50% daily email usage reached`;
  const html = `
    <p>Hello ${organization.contactName || "Team"},</p>
    <p>Your organization <strong>${organization.name}</strong> has reached <strong>${kind === "full" ? "100%" : "50%"}</strong> of its daily sending limit.</p>
    <p>Usage: <strong>${usage.projected}/${usage.dailyLimit}</strong></p>
    <p>If you need higher limits, contact the platform administrator.</p>
  `;

  await sendEmail({
    to: organization.contactEmail,
    subject,
    html
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
    dailyLimit: organization.dailyLimit,
    isBlocked: organization.isBlocked,
    allowOverLimitOverride: organization.allowOverLimitOverride,
    lastHalfAlertAt: organization.lastHalfAlertAt,
    lastFullAlertAt: organization.lastFullAlertAt
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

  if (limitCheck.shouldSendHalfAlert || limitCheck.shouldSendFullAlert) {
    const updates = {};
    if (limitCheck.shouldSendHalfAlert) updates.lastHalfAlertAt = new Date();
    if (limitCheck.shouldSendFullAlert) updates.lastFullAlertAt = new Date();

    await prisma.organization.update({
      where: { id: organization.id },
      data: updates
    });

    if (limitCheck.shouldSendHalfAlert) {
      await sendUsageAlertEmail(organization, "half", limitCheck);
    }
    if (limitCheck.shouldSendFullAlert) {
      await sendUsageAlertEmail(organization, "full", limitCheck);
    }
  }

  if (env.queueMode === "redis") {
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
  } else {
    await Promise.all(
      deduped.map(async (item) => {
        try {
          await sendEmail({
            to: item.to,
            subject: item.subject,
            html: item.html,
            attachments: item.attachments || []
          });
          await prisma.emailLog.create({
            data: {
              orgId: organization.id,
              email: item.to,
              subject: item.subject,
              body: item.html,
              status: "success",
              attempts: 1,
              attachments: item.attachments || []
            }
          });
        } catch (error) {
          await prisma.emailLog.create({
            data: {
              orgId: organization.id,
              email: item.to,
              subject: item.subject,
              body: item.html,
              status: "failed",
              attempts: 1,
              errorMessage: error.message,
              attachments: item.attachments || []
            }
          });
          throw error;
        }
      })
    );
  }

  return {
    allowed: true,
    queued: deduped.length,
    deduplicatedFrom: validated.length,
    warning: limitCheck.warning,
    warningMessage: limitCheck.warning ? limitCheck.message : "",
    state: limitCheck.state,
    mode: env.queueMode
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
