const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  queueMode: process.env.QUEUE_MODE || (process.env.NODE_ENV === "development" ? "inline" : "redis"),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  defaultDailyEmailLimit: Number(process.env.DEFAULT_DAILY_EMAIL_LIMIT || 100),
  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200)
};
