# Pratyaksh - Forensic AI

Pratyaksh is a forensic-AI dashboard with departments for fingerprint analysis, cyber forensics, and document forensics. The frontend is a React + Vite SPA and the backend is an Express API. Authentication uses one-time codes delivered via SMTP email.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Velqore/Pratyaksh)

Click the button above to deploy this project to your own Vercel account. Vercel will:

1. Ask you to pick a Git scope and project name.
2. Clone the repository and run `pnpm install` followed by the configured build.
3. Serve the React frontend at `/` and the Express API at `/api/*` from a single Node serverless function.

**No environment variables to fill in.** The `DATABASE_URL` and `SMTP_*` configuration are baked into [`vercel.json`](./vercel.json) so the Deploy button takes you from "click" to "live URL" without any extra forms.

### What this deploys

- The `pratyaksh` web artifact, served as static assets out of `artifacts/pratyaksh/dist/public`.
- The `api-server` artifact, bundled with esbuild and exposed through `api/index.mjs` as a Vercel Node serverless function. All `/api/*` requests are rewritten to that function; everything else falls back to `index.html` for client-side routing.
- The `mockup-sandbox` design canvas is **not** deployed.

### ⚠️ Security notice — credentials are public

This repository intentionally commits live credentials (`DATABASE_URL`, SMTP host/user/password, `SMTP_FROM`) inside `vercel.json` so the one-click deploy works without prompting the user for any values.

These credentials are visible to anyone who can read the repository. You have explicitly accepted that trade-off. If you fork this project, **rotate every credential before deploying** and move them out of `vercel.json` into Vercel project environment variables.

### Notes about the serverless runtime

- Any feature that depends on persistent writes to the function's local filesystem (for example, the fingerprint training pipeline, which writes `fingerprint_model.json` and training logs under `artifacts/api-server/server/`) will not survive across invocations on Vercel. Reads of files bundled at build time still work — only runtime writes are ephemeral.
- The OTP / login email flow does not write to disk and works end-to-end on Vercel using the baked-in SMTP credentials.

---

## 📜 License

> **⚠️ PROPRIETARY — ALL RIGHTS RESERVED**

This project is **NOT open source**. It is protected under a **Proprietary License** owned exclusively by **Ayush Tyagi (Velqore)**.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)

### ❌ You MAY NOT:

| Action | Status |
|---|---|
| Use, copy, execute, or deploy this software | 🚫 Prohibited |
| Modify, adapt, or create derivative works | 🚫 Prohibited |
| Sell, sublicense, rent, or distribute | 🚫 Prohibited |
| Reverse engineer or decompile the source code | 🚫 Prohibited |

> **All use requires prior written consent from Ayush Tyagi (Velqore).**

This software, including all source code, documentation, and associated files, is the exclusive proprietary property of **Ayush Tyagi (Velqore)** and is protected by copyright law, patent law, and applicable Indian and international intellectual property laws, including the **Indian Copyright Act, 1957**, the **Indian Patents Act, 1970**, and the **TRIPS Agreement**.

**Patent Notice:** This software and its underlying methods, systems, and processes may be protected by one or more patents or pending patent applications filed under the Indian Patents Act, 1970.

📄 Read the full license: **[LICENSE](./LICENSE)**

📬 For licensing inquiries or permission requests, contact **Ayush Tyagi (Velqore)** via the [official repository](https://github.com/Velqore/Pratyaksh-Ai).

---

## Local development

Local Replit development is unchanged. The artifact workflows (`artifacts/api-server`, `artifacts/pratyaksh`) continue to read `PORT` and `BASE_PATH` from the environment as before. The `vercel.json` and `api/` entrypoint only affect Vercel deployments.
