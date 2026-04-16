const prisma = require("../config/prisma");

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getTodayDateRange() {
  const start = getTodayUtcDate();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function getTodayEmailCount(orgId) {
  const { start, end } = getTodayDateRange();
  return prisma.emailLog.count({
    where: {
      orgId,
      timestamp: {
        gte: start,
        lt: end
      }
    }
  });
}

async function checkEmailLimit(orgId, emailCountRequested, options = {}) {
  const dailyLimit = options.dailyLimit || 100;
  const todayCount = await getTodayEmailCount(orgId);
  const projected = todayCount + emailCountRequested;
  const isSingleRequest = emailCountRequested === 1;

  if (todayCount >= dailyLimit || projected > dailyLimit) {
    if (isSingleRequest) {
      return {
        allowed: true,
        warning: true,
        message: "Limit exceeded, but single email allowed.",
        sentToday: todayCount,
        dailyLimit
      };
    }
    return {
      allowed: false,
      warning: false,
      message: `Daily limit reached (${dailyLimit} emails). Sending blocked.`,
      sentToday: todayCount,
      dailyLimit
    };
  }

  if (projected >= 50) {
    return {
      allowed: true,
      warning: true,
      message: `You have reached 50 emails. Daily limit is ${dailyLimit}.`,
      sentToday: todayCount,
      dailyLimit
    };
  }

  return {
    allowed: true,
    warning: false,
    message: "",
    sentToday: todayCount,
    dailyLimit
  };
}

module.exports = { getTodayUtcDate, getTodayDateRange, getTodayEmailCount, checkEmailLimit };
