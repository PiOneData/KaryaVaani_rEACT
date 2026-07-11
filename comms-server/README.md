# Comms Server — reusable WhatsApp communication gateway

A small, standalone HTTP service that sends and receives WhatsApp messages via
the **AOC portal ("BOT API") WhatsApp gateway**
(<https://developers.aoc-portal.com/whatsapp/webhook>). It is deliberately
app-agnostic: it holds the provider credentials server-side and exposes a clean
REST API, so any number of applications (Karya Vaani and others) can share one
messaging gateway without embedding tokens in their own code or in a browser.

The older **Meta WhatsApp Cloud API** provider is still included and can be
re-enabled with `WHATSAPP_PROVIDER=meta`. If no provider credentials are
configured, the server automatically runs in **mock mode** (messages are
logged, not sent) so the whole stack works end-to-end in development.

## Run

```bash
cd comms-server
cp .env.example .env      # fill in AOC creds (or leave blank for mock mode)
npm install
npm start                 # http://localhost:4100
```

## Configuration

All configuration is via environment variables — see `.env.example`. Key ones:

| Variable | Purpose |
| --- | --- |
| `PORT` | Listen port (default 4100) |
| `COMMS_API_KEY` | Shared secret required on send endpoints (`x-api-key`). Blank = no auth. |
| `WHATSAPP_PROVIDER` | `aoc` (default), `meta` or `mock` |
| `AOC_BASE_URL` | AOC portal API host (default `https://apis.aoc-portal.com`) |
| `AOC_API_KEY` | Portal account API key, sent as the `apikey` header |
| `AOC_FROM_ID` | Sender number = the portal "From Id", digits only (e.g. `918220099940`) |
| `AOC_WEBHOOK_TOKEN_HEADER`, `AOC_WEBHOOK_TOKEN` | Shared-secret header expected on inbound webhook calls |
| `META_*` | Legacy Meta Cloud API credentials (only when `WHATSAPP_PROVIDER=meta`) |
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

Numbers may be passed as 10-digit (India assumed) or full E.164 digits. The
message is sent from the configured `AOC_FROM_ID` number.

### `POST /v1/whatsapp/send-template`  *(requires `x-api-key`)*
Send an approved template (required for business-initiated messages outside the
24-hour session window).

```json
{ "to": "919876543210", "template": "worker_confirmation", "language": "te",
  "components": [ ... ] }
```

### `GET /v1/whatsapp/webhook`
Configuration probe. Answers the Meta `hub.challenge` handshake when the meta
provider is active; otherwise returns `200 {ok:true}` so portal "save & test"
pings succeed.

### `POST /v1/whatsapp/webhook`
**The single event endpoint.** The AOC portal POSTs every subscribed event
here — inbound messages, outbound delivery reports (sent / delivered / read /
failed) and any other metric or account events. Everything is stored in one
log and (optionally) forwarded to `COMMS_FORWARD_URL`. Calls must carry the
configured `AOC_WEBHOOK_TOKEN` header or they are rejected with 401.

### `GET /v1/whatsapp/messages?since=&direction=&from=&to=&limit=`
Poll the in-memory log of recent inbound/outbound messages, statuses and
events. Useful for a chat UI that wants to display two-way conversation
without a database. `direction` is one of `in`, `out`, `status`, `event`.

### `GET /v1/whatsapp/metrics`
Lifetime counters since boot: inbound, outbound, per-status delivery counts
(sent / delivered / read / failed), other events, last-event time.

## Using it from another application

Server-to-server (keep `COMMS_API_KEY` on the server side):

```js
await fetch("http://comms-server:4100/v1/whatsapp/send", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.COMMS_API_KEY },
  body: JSON.stringify({ to: "919876543210", message: "Hi" })
});
```

## AOC portal webhook setup

In the portal: **Whatsapp → Utility & Template → Webhook → Add Webhook →
Add Configuration** and fill in:

1. **Webhook Name** — anything, e.g. `karyavaani`.
2. **From Id** — the sender number (e.g. `+918220099940 KaryaVani`); must
   match `AOC_FROM_ID`.
3. **Provider** — `Generic`.
4. **End Point** — `https://<public-host>/api/whatsapp/webhook`
   (nginx proxies this to the comms server's `/v1/whatsapp/webhook`; if the
   comms server is exposed directly, use
   `https://<public-host>:4100/v1/whatsapp/webhook`).
5. **Add Headers** — add `x-webhook-token: <your AOC_WEBHOOK_TOKEN>` so the
   gateway can authenticate the portal's calls.
6. In the **Event List**, subscribe to all inbound, outbound/delivery-report
   and metric events — they all land on the same endpoint.

## Extending

The provider interface (`src/providers/*.js`) is intentionally small
(`sendText`, `sendTemplate`, `parseWebhook`, `verifyWebhook`, `verifyInbound`,
`verifySignature`). Add Twilio, SMS, or other channels by implementing the same
shape and registering it in `src/providers/index.js` / a new `src/channels/*`.
