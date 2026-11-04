import assert from "node:assert/strict";
import { prepareReceipt } from "./receipt_sender.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.INFRAI_API_KEY;
const order = { orderId: "test/order", customerEmail: "buyer@example.com", receiptPdf: "input-pdf" };
try {
  process.env.INFRAI_API_KEY = "test-key";
  await assert.rejects(prepareReceipt({ ...order, orderId: "" }), /too_small/);
  for (const uploadFails of [false, true]) {
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      if (url.endsWith("/pdf/watermark")) {
        assert.equal(body.pdf, "input-pdf");
        return Response.json({ ok: true, data: { url: "https://example.test/pdf" } });
      }
      if (url === "https://example.test/pdf") return new Response("watermarked-pdf");
      if (url === "https://example.test/upload") {
        assert.equal(init?.method, "PUT");
        assert.deepEqual(init?.headers, { "Content-Type": "application/pdf" });
        assert.equal(Buffer.from(init?.body as ArrayBuffer).toString(), "watermarked-pdf");
        return new Response(null, { status: uploadFails ? 403 : 200 });
      }
      assert.ok(url.endsWith("/receipts/receipts%2Ftest%2Forder.pdf"));
      if (body.op === "put") return Response.json({ ok: true, data: {
        url: "https://example.test/upload", method: "PUT", headers: { "Content-Type": "application/pdf" },
      } });
      assert.equal(body.op, "get");
      assert.ok(calls.includes("https://example.test/upload"));
      return Response.json({ ok: true, data: { url: "https://example.test/download" } });
    };
    if (uploadFails) {
      await assert.rejects(prepareReceipt(order), /Could not store/);
      assert.equal(calls.length, 4);
    } else {
      assert.deepEqual(await prepareReceipt(order), { orderId: order.orderId, downloadUrl: "https://example.test/download" });
      assert.equal(calls.length, 5);
    }
  }
  console.log("validation and upload-before-download checks passed");
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = originalKey;
}
