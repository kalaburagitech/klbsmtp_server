const { Worker } = require("bullmq");
const prisma = require("../config/prisma");
const { sendEmail } = require("../services/emailService");
const { queueConnection } = require("./emailQueue");

new Worker(
  "emailQueue",
  async (job) => {
    const { organizationId, to, subject, html, attachments } = job.data;
    try {
      await sendEmail({ to, subject, html, attachments });
      await prisma.emailLog.create({
        data: {
          orgId: organizationId,
          email: to,
          subject,
          body: html,
          status: "success",
          attempts: job.attemptsMade + 1,
          attachments: attachments || []
        }
      });
      return true;
    } catch (error) {
      await prisma.emailLog.create({
        data: {
          orgId: organizationId,
          email: to,
          subject,
          body: html,
          status: "failed",
          attempts: job.attemptsMade + 1,
          errorMessage: error.message,
          attachments: attachments || []
        }
      });
      throw error;
    }
  },
  { connection: queueConnection, limiter: { max: 50, duration: 1000 } }
);

console.log("Email worker running...");
