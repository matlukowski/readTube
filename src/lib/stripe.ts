import Stripe from 'stripe';

// Check if Stripe is configured - currently disabled for free app
export function isStripeEnabled(): boolean {
  return false; // Disabled - app is completely free
  // return !!process.env.STRIPE_SECRET_KEY; // Uncomment to re-enable payments
}

// Server-side Stripe instance - only initialize if key is available
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
      typescript: true,
    })
  : null;

export default stripe;

// Configuration constants
export const STRIPE_CONFIG = {
  // Unlimited access for 10 PLN
  PRICE_PLN: 1000, // in grosze (10.00 PLN)
  MINUTES_PER_PACKAGE: 999999, // Practically unlimited
  CURRENCY: 'pln' as const,
  PRODUCT_NAME: 'ReadTube - Dostęp bez limitu',
  PRODUCT_DESCRIPTION: 'ReadTube: Nieograniczone podsumowania filmów YouTube z AI',
};

// Helper function to create checkout session
export async function createCheckoutSession({
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY environment variable.');
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    billing_address_collection: 'required',
    line_items: [
      {
        price_data: {
          currency: STRIPE_CONFIG.CURRENCY,
          product_data: {
            name: STRIPE_CONFIG.PRODUCT_NAME,
            description: STRIPE_CONFIG.PRODUCT_DESCRIPTION,
          },
          unit_amount: STRIPE_CONFIG.PRICE_PLN,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    metadata: {
      userId,
      minutesPurchased: STRIPE_CONFIG.MINUTES_PER_PACKAGE.toString(),
    },
    invoice_creation: {
      enabled: true,
    },
    automatic_tax: {
      enabled: false, // Manual VAT handling for Poland
    },
  });

  return session;
}

// Helper function to retrieve checkout session
export async function retrieveCheckoutSession(sessionId: string) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY environment variable.');
  }
  
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });
}

// Helper to format minutes to readable time
export function formatMinutesToTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}min`;
}

// Helper to check if user has enough minutes
export function hasEnoughMinutes(minutesUsed: number, minutesPurchased: number): boolean {
  return minutesUsed < minutesPurchased;
}

// Helper to get remaining minutes
export function getRemainingMinutes(minutesUsed: number, minutesPurchased: number): number {
  return Math.max(0, minutesPurchased - minutesUsed);
}