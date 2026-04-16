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

function isSameUtcDay(dateA, dateB) {
  if (!dateA || !dateB) return false;
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

async function checkEmailLimit(orgId, emailCountRequested, options = {}) {
  const dailyLimit = options.dailyLimit || 100;
  const isBlocked = Boolean(options.isBlocked);
  const allowOverLimitOverride = Boolean(options.allowOverLimitOverride);
  const lastHalfAlertAt = options.lastHalfAlertAt ? new Date(options.lastHalfAlertAt) : null;
  const lastFullAlertAt = options.lastFullAlertAt ? new Date(options.lastFullAlertAt) : null;
  const todayCount = await getTodayEmailCount(orgId);
  const projected = todayCount + emailCountRequested;
  const halfLimit = Math.ceil(dailyLimit * 0.5);
  const today = getTodayUtcDate();

  if (isBlocked) {
    return {
      allowed: false,
      warning: false,
      state: "blocked",
      message: "Organization sending is blocked by admin.",
      sentToday: todayCount,
      projected,
      dailyLimit,
      shouldSendHalfAlert: false,
      shouldSendFullAlert: false
    };
  }

  if (projected > dailyLimit && !allowOverLimitOverride) {
    return {
      allowed: false,
      warning: false,
      state: "blocked",
      message: `Daily limit reached (${dailyLimit} emails). Sending blocked.`,
      sentToday: todayCount,
      projected,
      dailyLimit,
      shouldSendHalfAlert: false,
      shouldSendFullAlert: false
    };
  }

  const shouldSendHalfAlert =
    projected >= halfLimit &&
    todayCount < halfLimit &&
    !isSameUtcDay(lastHalfAlertAt, today);
  const shouldSendFullAlert =
    projected >= dailyLimit &&
    todayCount < dailyLimit &&
    !isSameUtcDay(lastFullAlertAt, today);

  if (shouldSendFullAlert) {
    return {
      allowed: true,
      warning: true,
      state: "fullReached",
      message: `Daily limit reached (${dailyLimit}/${dailyLimit}).`,
      sentToday: todayCount,
      projected,
      dailyLimit,
      shouldSendHalfAlert,
      shouldSendFullAlert
    };
  }

  if (shouldSendHalfAlert) {
    return {
      allowed: true,
      warning: true,
      state: "halfReached",
      message: `You reached 50% usage (${projected}/${dailyLimit}).`,
      sentToday: todayCount,
      projected,
      dailyLimit,
      shouldSendHalfAlert,
      shouldSendFullAlert
    };
  }

  if (projected >= dailyLimit) {
    return {
      allowed: true,
      warning: true,
      state: "fullReached",
      message: `Daily limit is at capacity (${projected}/${dailyLimit}).`,
      sentToday: todayCount,
      projected,
      dailyLimit,
      shouldSendHalfAlert: false,
      shouldSendFullAlert: false
    };
  }

  return {
    allowed: true,
    warning: false,
    state: "normal",
    message: "",
    sentToday: todayCount,
    projected,
    shouldSendHalfAlert: false,
    shouldSendFullAlert: false,
    dailyLimit
  };
}

module.exports = { getTodayUtcDate, getTodayDateRange, getTodayEmailCount, checkEmailLimit };
