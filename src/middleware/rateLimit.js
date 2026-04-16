const rateLimit = require("express-rate-limit");
const env = require("../config/env");

module.exports = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: env.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false
});
