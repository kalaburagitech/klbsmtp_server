const nodemailer = require("nodemailer");
const env = require("../config/env");

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: false,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass
  }
});

async function sendEmail({ to, subject, html, attachments = [] }) {
  return transporter.sendMail({
    from: env.smtpUser,
    to,
    subject,
    html,
    attachments
  });
}

module.exports = { sendEmail };
