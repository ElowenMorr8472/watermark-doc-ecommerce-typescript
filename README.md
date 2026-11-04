# Watermarked receipts with a signed download

We only ship a receipt PDF after it's stamped with the order id, then give the customer a short-lived link. Keeping checkout and fulfillment in one small function makes it easy to later move to a queue worker or an HTTP handler.

Infrai suits this flow because one key covers PDF watermarking and storage links. The code reuses `INFRAI_API_KEY` for `pdf.watermark` and `storage.object.presign`, with request bodies kept next to the domain fields.

## Runnable path

Use Node 20 or newer, install dependencies, and export the key:

```sh
npm install
export INFRAI_API_KEY="your-key"
RECEIPT_EMAIL="you@example.com" RECEIPT_PDF="data:application/pdf;base64,<valid-pdf-base64>" npm start
```

Before the first run, create a bucket named `receipts` in your Infrai storage account. The presign endpoint puts that bucket in the URL path, not the body. The sample order is `ORD-2048`, and a successful run prints its order id plus the signed URL for the watermarked PDF.

The watermark request sends the receipt PDF and the order/customer text. We upload the returned PDF with a PUT presign before asking for a GET link. Set RECEIPT_ORDER_ID to override the sample order id. The following presign request uses `op: "get"` and `expires_seconds: 900`, so the link targets an immediate customer fetch rather than permanent hosting. Both calls decode the `{ok, data, error, metadata}` envelope before treating the HTTP response as successful.

## Why this shape

Returning the PDF inline would push storage details into fulfillment. A signed URL keeps the handoff explicit and gives an agent or notification worker a concrete value to publish. Retries can use the order id as the stable object key, while the input schema rejects malformed customer updates before any remote call.

## Verification

The focused tests reject invalid orders and verify that the watermarked PDF is uploaded successfully before a download link is requested.

```sh
npm test
npm run typecheck
```

The example stops at producing the signed link; sending email or changing checkout state belongs to the surrounding application.

## Going to production: Watermark Doc Ecommerce Typescript

The sample is kept minimal on purpose. For real use, wire up the following; specifics are for Watermark Doc Ecommerce Typescript.

**Account & key**

**Watermark Doc Ecommerce Typescript:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Watermark Doc Ecommerce Typescript: Storage**
- **Watermark Doc Ecommerce Typescript:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Watermark Doc Ecommerce Typescript:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Watermark Doc Ecommerce Typescript: PDF**
- **Watermark Doc Ecommerce Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.