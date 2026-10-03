import { markPurchased, stripeWebhookSecret, verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe の Webhook（checkout.session.completed）を受けて、購入した友だちに「購入済み」タグを付ける
// 送信先の URL に ?w=<場所のID> を付けると、その場所（公式LINE）の友だちとして扱う（proxy.ts が判定）
export async function POST(req: Request) {
  let secret: string;
  try {
    secret = await stripeWebhookSecret();
  } catch {
    return new Response("unknown workspace", { status: 404 });
  }
  if (!secret) return new Response("stripe webhook not configured", { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return new Response("invalid signature", { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { client_reference_id?: string | null; payment_status?: string } };
  };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
      const friendId = await markPurchased(s.client_reference_id);
      if (!friendId) console.error("Stripe: 友だちが見つかりません（client_reference_id なし・不一致）");
      return Response.json({ received: true, friendId });
    }
  }
  return Response.json({ received: true });
}
