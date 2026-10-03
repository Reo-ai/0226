import { markPurchased, verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe の Webhook（checkout.session.completed）を受けて、購入した友だちに「購入済み」タグを付ける
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
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
