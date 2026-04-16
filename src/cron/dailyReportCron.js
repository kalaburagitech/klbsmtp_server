const cron = require("node-cron");
const prisma = require("../config/prisma");

function startDailyReportCron() {
  cron.schedule("0 0 * * *", async () => {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    const summary = await prisma.emailLog.groupBy({
      by: ["orgId", "status"],
      _count: { _all: true },
      where: { createdAt: { gte: since } }
    });
    console.log("Daily email report:", summary);
  });
}

module.exports = startDailyReportCron;
