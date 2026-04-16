const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const mountSwagger = require("./config/swagger");
const appRateLimit = require("./middleware/rateLimit");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(appRateLimit);

app.get("/health", (_, res) => res.json({ status: "ok" }));
app.use("/api/v1", routes);
mountSwagger(app);

app.use(errorHandler);

module.exports = app;
