'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Clock, Zap, AlertTriangle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUsage?: {
    remainingMinutes: number;
    formattedRemaining: string;
    subscriptionStatus: string;
  };
  requiredMinutes?: number;
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  userUsage,
  requiredMinutes 
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [stripeAvailable, setStripeAvailable] = useState(true);

  useEffect(() => {
    // Check if Stripe is available by making a test call
    const checkStripeAvailability = async () => {
      try {
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.status === 503) {
          const data = await response.json();
          if (data.code === 'STRIPE_NOT_CONFIGURED') {
            setStripeAvailable(false);
          }
        }
      } catch (error) {
        console.log('Stripe availability check failed:', error);
        setStripeAvailable(false);
      }
    };

    if (isOpen) {
      checkStripeAvailability();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePayment = async () => {
    if (loading) return;
    
    setLoading(true);
    setError('');

    try {
      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Błąd podczas tworzenia sesji płatności');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas płatności');
      setLoading(false);
    }
  };

  const packageDetails = {
    price: '25,00 zł',
    duration: '5 godzin',
    minutes: 300,
    features: [
      'Analizy filmów do 5 godzin łącznie',
      'Nielimitowana liczba krótkich filmów',
      'Podsumowania AI w języku polskim',
      'Zapisywanie w bibliotece',
      'Bez limitu czasowego ważności'
    ]
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-base-100 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">ReadTube - Dokup więcej czasu</h2>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current usage status */}
          {userUsage && (
            <div className="alert">
              <Clock className="w-5 h-5" />
              <div>
                <div className="font-medium">Aktualny stan konta</div>
                <div className="text-sm opacity-70">
                  Pozostało: <span className="font-medium">{userUsage.formattedRemaining}</span>
                  {requiredMinutes && (
                    <> • Potrzeba: <span className="font-medium">{requiredMinutes} min</span></>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Demo mode notification */}
          {!stripeAvailable && (
            <div className="alert alert-warning">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <div className="font-medium">Tryb Demo</div>
                <div className="text-sm">
                  System płatności jest obecnie niedostępny. Aplikacja działa w trybie demonstracyjnym.
                </div>
              </div>
            </div>
          )}

          {/* Package details */}
          <div className="card bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">Pakiet 5 godzin</h3>
                  <p className="text-sm opacity-70">Jednorazowa płatność</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{packageDetails.price}</div>
                  <div className="text-sm opacity-70">za {packageDetails.duration}</div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <h4 className="font-medium">W pakiecie:</h4>
                <ul className="space-y-1">
                  {packageDetails.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-base-100 rounded-lg p-3 text-center">
                <div className="text-sm text-base-content/70">
                  Po zakupie otrzymasz dodatkowe <span className="font-bold text-primary">300 minut</span>
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {/* Payment button */}
          <button
            onClick={handlePayment}
            disabled={loading || !stripeAvailable}
            className={`btn w-full ${!stripeAvailable ? 'btn-disabled' : 'btn-primary'}`}
          >
            {!stripeAvailable ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                Płatności niedostępne w trybie demo
              </>
            ) : loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Przekierowanie do płatności...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Zapłać {packageDetails.price}
              </>
            )}
          </button>

          {/* Payment info */}
          <div className="text-xs text-base-content/60 text-center space-y-1">
            <p>Bezpieczna płatność przez Stripe</p>
            <p>Po płatności minuty zostaną automatycznie dodane do Twojego konta</p>
          </div>
        </div>
      </div>
    </div>
  );
}