import app, { verifySmtpOnBoot } from "../artifacts/api-server/dist/app.mjs";

let bootChecked = false;
function ensureBootCheck() {
  if (bootChecked) return;
  bootChecked = true;
  if (typeof verifySmtpOnBoot === "function") {
    Promise.resolve()
      .then(() => verifySmtpOnBoot())
      .catch(() => {
        /* swallow — diagnostics surface via /api/email/smtp-status */
      });
  }
}

export default function handler(req, res) {
  ensureBootCheck();
  return app(req, res);
}
