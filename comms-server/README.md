# Comms Server — reusable WhatsApp communication gateway

A small, standalone HTTP service that sends and receives WhatsApp messages via
the **Meta WhatsApp Cloud API**. It is deliberately app-agnostic: it holds the
provider credentials server-side and exposes a clean REST API, so any number of
applications (Karya Vaani and others) can share one messaging gateway without
embedding tokens in their own code or in a browser.

If Meta credentials are not configured, the server automatically runs in **mock
mode** (messages are logged, not sent) so the whole stack works end-to-end in
development.

## Run

```bash
cd comms-server
cp .env.example .env      # fill in Meta creds (or leave blank for mock mode)
npm install
npm start                 # http://localhost:4100
```

## Configuration

All configuration is via environment variables — see `.env.example`. Key ones:

| Variable | Purpose |
| --- | --- |
| `PORT` | Listen port (default 4100) |
| `COMMS_API_KEY` | Shared secret required on send endpoints (`x-api-key`). Blank = no auth. |
| `WHATSAPP_PROVIDER` | `meta` or `mock` |
| `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN` | Meta Cloud API credentials |
| `META_VERIFY_TOKEN` | Webhook verification token (you choose it) |
| `META_APP_SECRET` | Enables inbound webhook signature checks |
| `COMMS_FORWARD_URL` | Optional: push every inbound message/status to another app |

## API

Base path: `/v1/whatsapp`

### `GET /health`
Service + active-provider status.

### `POST /v1/whatsapp/send`  *(requires `x-api-key`)*
Send a free-form text message to one or many recipients.

```json
{ "to": ["919876543210", "919812345678"], "message": "Hello from Karya Vaani" }
```

Numbers may be passed as 10-digit (India assumed) or full E.164 digits.

### `POST /v1/whatsapp/send-template`  *(requires `x-api-key`)*
Send an approved template (required for business-initiated messages outside the
24-hour session window).

```json
{ "to": "919876543210", "template": "worker_confirmation", "language": "te",
  "components": [ ... ] }
```

### `GET /v1/whatsapp/webhook`
Meta verification handshake (configure this URL in the Meta dashboard).

### `POST /v1/whatsapp/webhook`
Receives inbound messages and delivery statuses from Meta. Stores them and
(optionally) forwards to `COMMS_FORWARD_URL`.

### `GET /v1/whatsapp/messages?since=&direction=&from=&to=&limit=`
Poll the in-memory log of recent inbound/outbound messages and statuses. Useful
for a chat UI that wants to display two-way conversation without a database.
`direction` is one of `in`, `out`, `status`.

## Using it from another application

Server-to-server (keep `COMMS_API_KEY` on the server side):

```js
await fetch("http://comms-server:4100/v1/whatsapp/send", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.COMMS_API_KEY },
  body: JSON.stringify({ to: "919876543210", message: "Hi" })
});
```

## Meta webhook setup

1. In Meta for Developers → your app → WhatsApp → Configuration, set the
   callback URL to `https://<public-host>/v1/whatsapp/webhook` and the verify
   token to your `META_VERIFY_TOKEN`.
2. Subscribe to the `messages` field.
3. (Recommended) Set `META_APP_SECRET` and `COMMS_VERIFY_SIGNATURE=true`.

## Extending

The provider interface (`src/providers/*.js`) is intentionally small
(`sendText`, `sendTemplate`, `parseWebhook`, `verifyWebhook`,
`verifySignature`). Add Twilio, SMS, or other channels by implementing the same
shape and registering it in `src/providers/index.js` / a new `src/channels/*`.
