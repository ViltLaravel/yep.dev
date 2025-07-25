import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const body = await req.json();
    const creditsToBuy = body.credits;
    if (!creditsToBuy || typeof creditsToBuy !== 'number' || creditsToBuy <= 0) {
      return new NextResponse("Invalid credits amount", { status: 400 });
    }

    // Calculate price and fee
    // Example: $1 per credit (adjust as needed)
    const pricePerCredit = 1.0;
    let amount = creditsToBuy * pricePerCredit;
    let fee = 0;
    if (amount >= 20) {
      fee = amount * 0.055;
    } else {
      fee = 0.80;
    }
    const totalAmount = Math.round((amount + fee) * 100); // in cents
    const netCredits = amount - fee; // credits after fee

    // Create checkout session for one-time payment
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${netCredits.toFixed(2)} AI Credits (after fee)`,
            },
            unit_amount: totalAmount, // in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,
      metadata: {
        userId: user.id,
        credits: creditsToBuy,
        netCredits: netCredits.toFixed(2),
        fee: fee.toFixed(2),
        amount: amount.toFixed(2),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
