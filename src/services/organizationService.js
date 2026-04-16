const prisma = require("../config/prisma");
const crypto = require("crypto");
const env = require("../config/env");

function generateApiKey() {
  return `org_${crypto.randomBytes(24).toString("hex")}`;
}

async function createOrganization({ name, dailyLimit, status }) {
  return prisma.organization.create({
    data: {
      name,
      apiKey: generateApiKey(),
      dailyLimit: dailyLimit || env.defaultDailyEmailLimit,
      status: status || "active"
    }
  });
}

async function listOrganizations() {
  return prisma.organization.findMany({
    orderBy: { createdAt: "desc" }
  });
}

module.exports = { createOrganization, listOrganizations };
