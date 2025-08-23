'use client';

import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';
import Header from '@/components/layout/Header';
import Link from 'next/link';

export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Cancelled Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-warning/20 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-warning" />
            </div>
          </div>

          {/* Cancelled Message */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h1 className="text-3xl font-bold mb-4 text-warning">
                Płatność została anulowana
              </h1>
              
              <p className="text-lg mb-6">
                Nie martw się - żadne opłaty nie zostały pobrane z Twojego konta.
              </p>

              {/* Info */}
              <div className="bg-info/5 rounded-lg p-6 mb-6">
                <h3 className="font-bold mb-3">Co się stało?</h3>
                <p className="text-left">
                  Proces płatności został przerwany przed zakończeniem. 
                  To może się zdarzyć, jeśli anulowałeś płatność, zamknąłeś przeglądarkę 
                  lub wystąpił problem z kartą płatniczą.
                </p>
              </div>

              {/* What's Next */}
              <div className="text-left mb-6">
                <h3 className="font-bold mb-3">Co możesz teraz zrobić:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span>Spróbować ponownie z tym samym lub innym sposobem płatności</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span>Kontynuować korzystanie z darmowej godziny analiz</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span>Skontaktować się z nami w przypadku problemów</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => window.history.back()}
                  className="btn btn-primary"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Spróbuj ponownie
                </button>
                
                <Link 
                  href="/analyze" 
                  className="btn btn-outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Wróć do analizowania
                </Link>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-sm text-base-content/60">
            <p>
              Masz problem z płatnością? Skontaktuj się z nami.
            </p>
            <p className="mt-2">
              Twoje darmowe minuty nadal są dostępne i możesz z nich korzystać.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}