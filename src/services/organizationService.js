const prisma = require("../config/prisma");
const crypto = require("crypto");
const env = require("../config/env");

function generateApiKey() {
  return `org_${crypto.randomBytes(24).toString("hex")}`;
}

async function createOrganization({ name, dailyLimit, status, contactName, contactEmail }) {
  return prisma.organization.create({
    data: {
      name,
      apiKey: generateApiKey(),
      contactName,
      contactEmail,
      dailyLimit: dailyLimit || env.defaultDailyEmailLimit,
      status: status || "active",
      isBlocked: false,
      allowOverLimitOverride: false
    }
  });
}

async function listOrganizations(filters = {}) {
  const { status, blocked, search } = filters;
  const where = {};
  if (status) where.status = status;
  if (blocked === true || blocked === false) where.isBlocked = blocked;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { contactEmail: { contains: search, mode: "insensitive" } }
    ];
  }

  return prisma.organization.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });
}

async function updateOrganizationControls(id, { isBlocked, allowOverLimitOverride }) {
  return prisma.organization.update({
    where: { id },
    data: {
      ...(typeof isBlocked === "boolean" ? { isBlocked } : {}),
      ...(typeof allowOverLimitOverride === "boolean" ? { allowOverLimitOverride } : {})
    }
  });
}

module.exports = { createOrganization, listOrganizations, updateOrganizationControls };
