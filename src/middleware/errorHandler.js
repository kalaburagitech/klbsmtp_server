function errorHandler(error, req, res, next) {
  let status = error.status;
  let message = error.message || "Internal server error";
  let details = error.details ?? null;
  let responseCode;

  const prismaCode = error.errorCode || error.code;
  const isDbAuth =
    prismaCode === "P1000" ||
    (typeof message === "string" &&
      message.includes("Authentication failed against database"));

  if (status == null && isDbAuth) {
    status = 503;
    responseCode = "DATABASE_UNAVAILABLE";
    message =
      "Cannot connect to the database. Set DATABASE_URL to a valid PostgreSQL URL (user, password, host, and database name).";
    if (process.env.NODE_ENV === "development") {
      details = {
        hint: "Local: check server/.env. Deployed: check your host’s environment variables.",
        prisma: error.message
      };
    }
  }

  status = status || 500;
  const payload = { message, details };
  if (responseCode) payload.code = responseCode;
  res.status(status).json(payload);
}

module.exports = errorHandler;
