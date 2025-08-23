'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import AnalyzeBar from '@/components/analyze/AnalyzeBar';
import Header from '@/components/layout/Header';
import { Play, Brain, Sparkles, Users } from 'lucide-react';

export default function HomePage() {
  const { isSignedIn } = useUser();

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            Analizuj filmy YouTube z AI
          </h1>
          <p className="text-xl text-base-content/70 mb-8">
            Wklej link do filmu YouTube i otrzymaj szczegółowe podsumowanie AI
          </p>
          
          <div className="max-w-2xl mx-auto">
            <AnalyzeBar />
          </div>
          
          {!isSignedIn && (
            <div className="mt-6">
              <Link href="/sign-in" className="btn btn-primary btn-lg">
                Rozpocznij za darmo
              </Link>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Play className="w-12 h-12 text-primary mb-4" />
              <h3 className="card-title">Analiza URL</h3>
              <p className="text-base-content/70">
                Wklej link do filmu YouTube i natychmiast otrzymaj szczegółową analizę
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Brain className="w-12 h-12 text-secondary mb-4" />
              <h3 className="card-title">Podsumowania AI</h3>
              <p className="text-base-content/70">
                Otrzymaj inteligentne podsumowania treści filmów wygenerowane przez AI
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Sparkles className="w-12 h-12 text-accent mb-4" />
              <h3 className="card-title">Automatyczna transkrypcja</h3>
              <p className="text-base-content/70">
                Automatyczne generowanie transkrypcji filmów z użyciem nowoczesnej technologii AI
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Users className="w-12 h-12 text-info mb-4" />
              <h3 className="card-title">Biblioteka wiedzy</h3>
              <p className="text-base-content/70">
                Automatycznie zapisuj analizy i buduj swoją osobistą bibliotekę wiedzy
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">Jak to działa</h2>
          
          <div className="steps steps-vertical lg:steps-horizontal w-full">
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Wklej URL</h4>
                <p className="text-sm text-base-content/70">
                  Podaj link do filmu YouTube
                </p>
              </div>
            </div>
            
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Transkrypcja</h4>
                <p className="text-sm text-base-content/70">
                  Automatyczne generowanie transkrypcji
                </p>
              </div>
            </div>
            
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Podsumowanie AI</h4>
                <p className="text-sm text-base-content/70">
                  Inteligentne streszczenie treści
                </p>
              </div>
            </div>
            
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Biblioteka</h4>
                <p className="text-sm text-base-content/70">
                  Automatyczny zapis do kolekcji
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!isSignedIn && (
          <div className="text-center mt-20">
            <div className="card bg-primary text-primary-content">
              <div className="card-body">
                <h2 className="card-title text-2xl justify-center">
                  Gotowy na odkrycie wiedzy z YouTube?
                </h2>
                <p>Zacznij analizować filmy YouTube z pomocą sztucznej inteligencji</p>
                <div className="card-actions justify-center mt-4">
                  <Link href="/sign-up" className="btn btn-secondary btn-lg">
                    Rozpocznij za darmo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
