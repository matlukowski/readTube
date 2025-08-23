import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import stripe, { isStripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  // Check if Stripe is enabled
  if (!isStripeEnabled() || !stripe || !endpointSecret) {
    console.error('❌ Stripe webhook called but Stripe is not configured');
    return NextResponse.json({
      error: 'Stripe webhooks are not available. Stripe is not configured.',
      code: 'STRIPE_NOT_CONFIGURED'
    }, { status: 503 });
  }
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('❌ No Stripe signature found');
    return NextResponse.json({ error: 'No signature found' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  console.log(`🔔 Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`❌ Error processing webhook ${event.type}:`, error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const minutesPurchased = parseInt(session.metadata?.minutesPurchased || '300');

  if (!userId) {
    console.error('❌ No userId found in checkout session metadata');
    return;
  }

  console.log(`✅ Checkout completed for user ${userId}, session: ${session.id}`);

  try {
    // Create payment record
    await prisma.payment.create({
      data: {
        userId,
        stripeSessionId: session.id,
        stripePaymentId: session.payment_intent as string,
        amount: session.amount_total || 2500,
        currency: session.currency || 'pln',
        status: 'completed',
        minutesPurchased,
        completedAt: new Date(),
      },
    });

    // Update user's purchased minutes and status
    await prisma.user.update({
      where: { id: userId },
      data: {
        minutesPurchased: {
          increment: minutesPurchased,
        },
        subscriptionStatus: 'PAID',
        lastPurchaseAt: new Date(),
      },
    });

    console.log(`💰 User ${userId} credited with ${minutesPurchased} minutes`);
  } catch (error) {
    console.error('❌ Error updating user after payment:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
  
  // Update payment status if exists
  await prisma.payment.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { status: 'completed', completedAt: new Date() },
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`❌ Payment failed: ${paymentIntent.id}`);
  
  // Update payment status if exists
  await prisma.payment.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { status: 'failed' },
  });
}