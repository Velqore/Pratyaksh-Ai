import fs from "fs";
import app from "./app";
import { logger } from "./lib/logger";
import { SERVER_DATA_DIR } from "./lib/paths.js";
import { verifySmtpOnBoot } from "./routes/email-auth.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const modelPath = `${SERVER_DATA_DIR}/fingerprint_model.json`;
logger.info(
  { serverDataDir: SERVER_DATA_DIR, modelFound: fs.existsSync(modelPath) },
  "Data path check",
);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  void verifySmtpOnBoot();
});
