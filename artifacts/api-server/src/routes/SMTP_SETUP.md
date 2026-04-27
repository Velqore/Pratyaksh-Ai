# SMTP setup for Pratyaksh OTP email

The OTP login dialog calls `POST /api/email/send-otp`, which uses
[Nodemailer](https://nodemailer.com/) over plain SMTP. The server reads
configuration from environment variables — nothing is hardcoded.

## Required environment variables

| Variable          | Required | Example                 | Notes                                                     |
| ----------------- | -------- | ----------------------- | --------------------------------------------------------- |
| `SMTP_HOST`       | yes      | `smtp.gmail.com`        | SMTP server hostname.                                     |
| `SMTP_USER`       | yes      | `forensics@example.com` | Login user (usually the full email address).              |
| `SMTP_PASS`       | yes      | (16-char app password)  | App-password for Gmail / Workspace, NOT your real login.  |
| `SMTP_PORT`       | no       | `587`                   | Defaults to `587`.                                        |
| `SMTP_SECURE`     | no       | `false`                 | `true` for port 465 (implicit TLS), `false` for 587 STARTTLS. |
| `SMTP_FROM`       | no       | `noreply@example.com`   | From address. Defaults to `SMTP_USER`.                    |
| `SMTP_FROM_NAME`  | no       | `Pratyaksh Forensic AI` | Display name on outgoing email.                           |
| `SMTP_TEST_TOKEN` | no       | (random string)         | If set, required to call `POST /api/email/send-test`. Always required in production. |

If any of the three required vars are missing, `POST /api/email/send-otp`
returns HTTP **503** with `{ "code": "smtp_not_configured" }` instead of
silently pretending success.

## Port 465 vs 587 — which one?

Two equally valid SMTP submission ports exist. Pick **one** consistent
combination — mixing them is the most common cause of "connection refused"
or TLS handshake errors:

- **Port 587 (STARTTLS)** — set `SMTP_PORT=587` and `SMTP_SECURE=false`.
  The connection starts in plaintext and is upgraded to TLS via the
  `STARTTLS` command. This is the modern default.
- **Port 465 (implicit TLS)** — set `SMTP_PORT=465` and `SMTP_SECURE=true`.
  The connection is wrapped in TLS from the first byte. Some networks
  block port 587, in which case 465 is the fallback.

Replit's outbound network allows both 465 and 587. If you see
`ECONNREFUSED` or "connection timed out", it is almost always a wrong
`SMTP_SECURE` / port pairing.

## Gmail / Google Workspace

1. The account **must** have 2-Step Verification turned on
   (`https://myaccount.google.com/security`). Plain account passwords
   are no longer accepted by Gmail SMTP.
2. Create an **App password**:
   `https://myaccount.google.com/apppasswords` → "Mail" / "Other".
   Google returns a 16-character string like `abcd efgh ijkl mnop`.
3. Use that app password as `SMTP_PASS`. Spaces are stripped automatically.
4. Recommended Gmail config:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your.address@gmail.com
   SMTP_PASS=abcdefghijklmnop
   SMTP_FROM=your.address@gmail.com
   SMTP_FROM_NAME=Pratyaksh Forensic AI
   ```

5. Common Gmail error responses you may see in the logs / API response:

   - `Invalid login: 535-5.7.8 Username and Password not accepted` →
     2FA off, or you used your account password instead of an app password.
   - `5.7.0 Authentication Required` → `SMTP_USER` and `SMTP_FROM` mismatch
     for a non-aliased Gmail account.
   - `Daily user sending limit exceeded` → free Gmail caps at ~500 messages/day.

## Other providers

- **SendGrid SMTP**: `smtp.sendgrid.net`, port 587, `SMTP_USER=apikey`,
  `SMTP_PASS=<your_api_key>`.
- **Mailgun**: `smtp.mailgun.org`, port 587, the SMTP credentials are
  shown under "Domain settings → SMTP credentials".
- **AWS SES**: regional host (e.g. `email-smtp.us-east-1.amazonaws.com`),
  port 587, generated SMTP credentials (NOT your AWS access key).

## SPF / DKIM / DMARC — why your mail lands in spam

Even when SMTP succeeds, recipients (Gmail, Outlook) may silently route
the message to spam if the sender domain does not authorize your SMTP
server. Two minimum checks:

- **SPF**: the DNS `TXT` record at the root of your sending domain must
  include the SMTP provider, e.g. `v=spf1 include:_spf.google.com ~all`
  for Gmail/Workspace, or `include:sendgrid.net` for SendGrid.
- **DKIM**: the provider gives you one or more DNS `CNAME` / `TXT`
  records to add. Until they are live, Gmail prepends "via
  <smtp host>" to your sender name.

For a quick deliverability test send a message to `check-auth@verifier.port25.com`
or use https://www.mail-tester.com/.

## Diagnosing problems

1. **Boot log**: when the API server starts it runs `transporter.verify()`
   once and logs the result. Look for either
   `"SMTP transporter verified successfully"` or
   `"SMTP transporter verification FAILED"` with `code` / `response`.
2. **`GET /api/email/smtp-status`**: re-runs `verify()` on demand and
   returns `{ configured, host, port, secure, user (masked), verifyOk,
   verifyError, lastError }`. The sign-in dialog exposes a small
   "Test email service" link that calls this endpoint.
3. **`POST /api/email/send-test`** (body: `{ "email": "you@example.com",
   "token": "<SMTP_TEST_TOKEN if set>" }`): sends a hardcoded test message
   so you can isolate SMTP issues from OTP-flow issues.

   In `NODE_ENV=production` the endpoint is disabled unless
   `SMTP_TEST_TOKEN` is set and matches the supplied `token`.

If `verify()` succeeds but `send-test` fails, the problem is the sender
address (`SMTP_FROM`) being rejected by your provider, not SMTP auth.
