const prisma = require("../config/prisma");
const crypto = require("crypto");
const env = require("../config/env");
const { getTodayDateRange } = require("./limitService");

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

  const organizations = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  if (organizations.length === 0) return organizations;

  const { start, end } = getTodayDateRange();
  const sentTodayByOrg = await prisma.emailLog.groupBy({
    by: ["orgId"],
    where: {
      orgId: { in: organizations.map((org) => org.id) },
      timestamp: {
        gte: start,
        lt: end
      }
    },
    _count: { _all: true }
  });

  const sentTodayMap = new Map(sentTodayByOrg.map((item) => [item.orgId, item._count._all]));
  return organizations.map((org) => ({
    ...org,
    sentToday: sentTodayMap.get(org.id) || 0
  }));
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
