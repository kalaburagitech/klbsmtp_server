const app = require("./app");
const env = require("./config/env");
const startDailyReportCron = require("./cron/dailyReportCron");

app.listen(env.port, () => {
  console.log(`API running on port ${env.port}`);
  startDailyReportCron();
});
