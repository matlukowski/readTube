import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createCheckoutSession, isStripeEnabled } from '@/lib/stripe';
import { getOrCreateUser } from '@/lib/user';

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is enabled
    if (!isStripeEnabled()) {
      return NextResponse.json({
        error: 'Payment system is not available. Stripe is not configured.',
        code: 'STRIPE_NOT_CONFIGURED'
      }, { status: 503 });
    }

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000';
    
    // Create Stripe checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      successUrl: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/payment/cancelled`,
    });

    console.log(`💳 Checkout session created for user ${user.id}:`, session.id);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Payment error: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create payment session' },
      { status: 500 }
    );
  }
}