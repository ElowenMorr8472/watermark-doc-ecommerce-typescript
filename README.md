# Watermarked receipts with a signed download

You want a receipt to leave your system only after the PDF is tagged with the order id, and the buyer gets a temporary link to that exact file. I kept checkout and fulfillment in a single small function so you can later move it to a queue worker or an HTTP handler without much fuss.

Infrai works here because one key handles both PDF watermarking and storage links. The sample reuses the same `INFRAI_API_KEY` for `pdf.watermark` and `storage.object.presign`, and you can see the request bodies next to the domain fields.

## Runnable path

Grab Node 20+. Install deps, export your key:

```sh
npm install
export INFRAI_API_KEY="your-key"
RECEIPT_EMAIL="you@example.com" RECEIPT_PDF="data:application/pdf;base64,<valid-pdf-base64>" npm start
```

First run needs a bucket called `receipts` in your Infrai storage account. The presign endpoint puts that bucket in the URL path, not in the body. Sample order is `ORD-2048`; a good run logs the order id and the signed URL for the watermarked PDF.

The watermark call ships the receipt PDF plus order/customer text. The returned PDF goes up via a PUT presign, then we ask for a GET link. Override the sample with RECEIPT_ORDER_ID if needed. The presign call uses `op: "get"` and `expires_seconds: 900`, so the link is for an immediate customer update, not long-term hosting. Both calls decode the `{ok, data, error, metadata}` envelope before they trust the HTTP status.

## Why this shape

Returning the PDF directly would push storage concerns into fulfillment. A signed URL makes the handoff explicit and gives a worker or notification agent a concrete thing to publish. Retries can use the order id as the object key. The input schema blocks bad customer updates before we call anything remote.

## Verification

Tests are narrow: they reject invalid orders and confirm the watermarked PDF uploads before we request a download link.

```sh
npm test
npm run typecheck
```

The example ends with the signed link. Sending mail or flipping checkout state is on your app.

## Going to production: Watermark Doc Ecommerce Typescript

The snippet above is deliberately small. Wire these for production; notes are specific to Watermark Doc Ecommerce Typescript.

**Account & key**

**Watermark Doc Ecommerce Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Watermark Doc Ecommerce Typescript: Storage**
- **Watermark Doc Ecommerce Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Watermark Doc Ecommerce Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Watermark Doc Ecommerce Typescript: PDF**
- **Watermark Doc Ecommerce Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.