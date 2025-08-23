'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowLeft, Clock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // You could fetch session details here if needed
      // For now, we'll just show success message
      setLoading(false);
    } else {
      // Redirect if no session ID
      router.push('/analyze');
    }
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
          </div>

          {/* Success Message */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h1 className="text-3xl font-bold mb-4 text-success">
                Płatność zakończona sukcesem!
              </h1>
              
              <p className="text-lg mb-6">
                Twój pakiet ReadTube na 5 godzin analiz został pomyślnie aktywowany.
              </p>

              {/* Package Info */}
              <div className="bg-success/5 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-success" />
                  <span className="text-xl font-bold">+5 godzin dodane do konta</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="stat">
                    <div className="stat-title">Dodane minuty</div>
                    <div className="stat-value text-success">300</div>
                    <div className="stat-desc">5 pełnych godzin</div>
                  </div>
                  
                  <div className="stat">
                    <div className="stat-title">Koszt</div>
                    <div className="stat-value text-success">25,00 zł</div>
                    <div className="stat-desc">Jednorazowo</div>
                  </div>
                </div>
              </div>

              {/* What's Next */}
              <div className="text-left mb-6">
                <h3 className="font-bold mb-3">Co możesz teraz zrobić:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span>Analizować filmy YouTube do łącznego czasu 5 godzin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span>Zapisywać analizy w swojej bibliotece</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span>Otrzymywać podsumowania AI w języku polskim</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  href="/analyze" 
                  className="btn btn-success"
                >
                  Rozpocznij analizę
                </Link>
                
                <Link 
                  href="/library" 
                  className="btn btn-outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Przejdź do biblioteki
                </Link>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-sm text-base-content/60">
            <p>
              Faktura została wysłana na Twój adres e-mail.
            </p>
            <p className="mt-2">
              Minuty nie wygasają i możesz z nich korzystać w dowolnym momencie.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}