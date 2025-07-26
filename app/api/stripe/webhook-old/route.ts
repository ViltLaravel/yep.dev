import { db as prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = headers().get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new NextResponse("Webhook signature verification failed", { status: 400 });
    }

    // console.log("Received event:", event.type);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const netCredits = Number(session.metadata?.netCredits);
      const eventId = event.id;
      // console.log("Session metadata:", session.metadata);
      // Idempotency: check if this event was already processed
      const alreadyProcessed = await prisma.processedEvent.findUnique({ where: { eventId } });
      if (alreadyProcessed) {
        // console.log("Event already processed, skipping:", eventId);
        return new NextResponse(null, { status: 200 });
      }
      if (!userId || !netCredits || netCredits <= 0) {
        console.warn("Missing or invalid userId/netCredits:", { userId, netCredits });
        return new NextResponse("Invalid metadata", { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error("User not found for credit update:", userId);
        return new NextResponse("User not found", { status: 404 });
      }
      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: netCredits } },
        });
        // Mark event as processed
        await prisma.processedEvent.create({ data: { eventId } });
        // console.log("Credits updated for user:", updatedUser.id, "New credits:", updatedUser.credits);
      } catch (err) {
        console.error("Failed to update user credits:", err);
        return new NextResponse("Failed to update credits", { status: 500 });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findFirst({
        where: {
          stripeCustomerId: subscription.customer as string,
        },
      });
      if (user) {
        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            isSubscribed: false,
          },
        });
        // console.log("Subscription deleted, user updated:", user.id);
      }
    }
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new NextResponse("Webhook handler failed", { status: 400 });
  }
}
