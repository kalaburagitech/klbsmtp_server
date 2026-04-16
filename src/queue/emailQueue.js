const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const env = require("../config/env");

const connection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null
});

const emailQueue = new Queue("emailQueue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 2000
  }
});

module.exports = { emailQueue, queueConnection: connection };
