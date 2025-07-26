import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { db as prisma } from '@/lib/db';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const sig = req.headers['stripe-signature'] as string;
    const buf = await buffer(req);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const netCredits = Number(session.metadata?.netCredits);
      const eventId = event.id;
      // Idempotency: check if this event was already processed
      const alreadyProcessed = await prisma.processedEvent.findUnique({ where: { eventId } });
      if (alreadyProcessed) {
        return res.status(200).json({ received: true });
      }
      if (!userId || !netCredits || netCredits <= 0) {
        console.warn('Missing or invalid userId/netCredits:', { userId, netCredits });
        return res.status(400).send('Invalid metadata');
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error('User not found for credit update:', userId);
        return res.status(404).send('User not found');
      }
      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: netCredits } },
        });
        // Mark event as processed
        await prisma.processedEvent.create({ data: { eventId } });
        // Optionally log success
        // console.log('Credits updated for user:', updatedUser.id, 'New credits:', updatedUser.credits);
      } catch (err) {
        console.error('Failed to update user credits:', err);
        return res.status(500).send('Failed to update credits');
      }
    }
    // Add more event types as needed

    res.status(200).json({ received: true });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
} 