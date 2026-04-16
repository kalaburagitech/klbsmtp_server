const prisma = require("../config/prisma");

async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return res.status(401).json({ message: "Missing x-api-key header" });

  const organization = await prisma.organization.findUnique({
    where: { apiKey }
  });
  if (!organization) return res.status(401).json({ message: "Invalid API key" });
  if (organization.status !== "active") {
    return res.status(403).json({ message: "Organization is inactive" });
  }
  if (organization.isBlocked) {
    return res.status(403).json({ message: "Organization is blocked by admin" });
  }

  req.org = organization;
  req.organization = organization;
  next();
}

module.exports = apiKeyAuth;
