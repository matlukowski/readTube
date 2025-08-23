# ReadTube

ReadTube to nowoczesna aplikacja webowa, która zamienia filmy YouTube w zwięzłe, inteligentne podsumowania. Analizuj treści wideo bez konieczności ich oglądania - idealne rozwiązanie dla osób ceniących swój czas.

**🌐 Live Demo**: [readtube.vercel.app](https://readtube.vercel.app) *(wkrótce)*

## ✨ Funkcjonalności

- 🎥 **Analiza filmów YouTube** - Wklej link i otrzymaj profesjonalne podsumowanie
- 🗣️ **Automatyczna transkrypcja** - Zaawansowana technologia Gladia API
- 🤖 **Podsumowania AI** - Inteligentne streszczenia w stylu dziennikarskim (OpenAI GPT-5 Nano)
- 📚 **Biblioteka analiz** - Zapisuj i organizuj swoje analizy
- 💳 **System płatności** - Stripe integration z pakietami godzin
- 🕐 **Usage tracking** - Śledzenie wykorzystanego czasu w minutach  
- 🌓 **Tryb jasny/ciemny** - Pełne wsparcie dla motywów DaisyUI
- 🔐 **Bezpieczna autoryzacja** - Clerk z polskim UI
- 📱 **Responsive design** - Działa na wszystkich urządzeniach

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, TypeScript, React 19
- **Styling**: Tailwind CSS 4, DaisyUI 5
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Authentication**: Clerk (polskie UI)
- **Płatności**: Stripe (webhooks, checkout sessions)
- **AI**: OpenAI GPT-5 Nano
- **Transkrypcja**: Gladia API v2
- **Deployment**: Vercel

## 💡 Jak to działa

1. **Wklej link YouTube** - Po prostu wklej URL filmu, który chcesz przeanalizować
2. **Automatyczna transkrypcja** - AI wyciąga tekst z nagrania głosowego
3. **Generowanie podsumowania** - GPT-5 tworzy zwięzłe streszczenie w stylu dziennikarskim
4. **Biblioteka** - Wszystkie analizy zapisują się automatycznie do Twojej kolekcji

## 🚀 Business Model

- **1 godzina gratis** - Każdy nowy użytkownik otrzymuje 60 minut analiz
- **Pay-per-use** - Dokup 5 godzin za 25 zł (użycie w minutach)
- **Bez subskrypcji** - Płacisz tylko za to, czego używasz
- **Minuty nie wygasają** - Wykupiony czas pozostaje na koncie

## 📁 Architektura

```
src/
├── app/                 # Next.js 15 App Router
│   ├── (auth)/         # Clerk authentication pages (Sign in/up, User profile)
│   ├── api/            # API routes (Stripe, Usage, Transcribe, Summarize)
│   ├── analyze/        # Główna strona analizy filmów
│   ├── library/        # Biblioteka zapisanych analiz
│   └── payment/        # Stripe payment flow (success/cancelled)
├── components/         # React components
│   ├── analyze/        # Komponenty analizy (AnalyzeBar)
│   ├── layout/         # Header, navigation
│   ├── payments/       # PaymentModal, Stripe integration
│   ├── providers/      # ThemeProvider z Clerk appearance
│   └── usage/          # UsageCounter, tracking
├── lib/               # Core utilities
│   ├── stripe.ts      # Stripe configuration & helpers
│   ├── usageMiddleware.ts # Usage limits & logging
│   ├── clerkAppearance.ts # Polish UI customization
│   ├── youtube.ts     # YouTube API & duration parsing
│   └── ai.ts          # OpenAI GPT-5 integration
└── prisma/            # Database schema (Users, Payments, UsageLog)
```

## 🔧 Kluczowe features techniczne

- **Usage-based billing** - Śledzenie wykorzystania w minutach z dokładnością co do sekundy
- **Stripe webhooks** - Automatyczne dodawanie minut po płatności
- **Smart caching** - Transkrypcje cachowane przez 7 dni
- **Error handling** - 402 Payment Required → Payment modal
- **Theme consistency** - Clerk UI dostosowane do DaisyUI
- **Polish localization** - Kompletnie spolszczony interfejs

---

**ReadTube** - *Inteligentne analizy YouTube w kilku kliknięciach* 🎥✨

Stworzył: [matlukowski](https://github.com/matlukowski) | Portfolio project 2024
