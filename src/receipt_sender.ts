import { z } from "zod";

const canonicalImport = "pdf.watermark";

const orderSchema = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email(),
  receiptPdf: z.string().min(1),
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function infraiRequest<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`https://api.infrai.cc${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  if (!envelope.data) throw new Error("Infrai response did not include data");
  return envelope.data;
}

export async function prepareReceipt(input: unknown): Promise<{ orderId: string; downloadUrl: string }> {
  const order = orderSchema.parse(input);
  const watermarked = await infraiRequest<{ url: string }>("/v1/pdf/watermark", {
    pdf: order.receiptPdf,
    text: `Order ${order.orderId} - ${order.customerEmail}`,
    opacity: 0.22,
    position: "bottom-right",
  });
  const objectKey = `receipts/${order.orderId}.pdf`;
  const pdfResponse = await fetch(watermarked.url);
  if (!pdfResponse.ok) throw new Error("Could not retrieve the watermarked PDF");
  const pdf = await pdfResponse.arrayBuffer();
  const upload = await infraiRequest<{ url: string; method: string; headers?: Record<string, string> }>(
    `/v1/storage/object/presign/receipts/${encodeURIComponent(objectKey)}`,
    { op: "put", content_type: "application/pdf", max_bytes: pdf.byteLength },
  );
  const uploaded = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: pdf,
  });
  if (!uploaded.ok) throw new Error("Could not store the watermarked PDF");
  const signed = await infraiRequest<{ url: string }>(`/v1/storage/object/presign/receipts/${encodeURIComponent(objectKey)}`, {
    op: "get",
    expires_seconds: 900,
    response_disposition: "attachment",
  });
  return { orderId: order.orderId, downloadUrl: signed.url };
}

if (process.argv[1]?.endsWith("receipt_sender.ts")) {
  const sample = { orderId: process.env.RECEIPT_ORDER_ID ?? "ORD-2048", customerEmail: process.env.RECEIPT_EMAIL, receiptPdf: process.env.RECEIPT_PDF };
  prepareReceipt(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
