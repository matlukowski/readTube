# 🚀 Instrukcja konfiguracji Supabase

## Kroki do wykonania:

### 1. Utwórz projekt w Supabase
- Idź na [supabase.com](https://supabase.com)
- Załóż konto i kliknij "New Project"
- Zapisz hasło do bazy danych!

### 2. Skopiuj klucze z Supabase Dashboard

W **Settings → API** znajdziesz:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

W **Settings → Database** znajdziesz:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxxx.supabase.co:5432/postgres
```

### 3. Zaktualizuj plik `.env.local`
Dodaj wszystkie klucze do swojego pliku `.env.local`

### 4. Utwórz tabele w bazie danych
```bash
# Wygeneruj klienta Prisma
npx prisma generate

# Wypchnij schemat do Supabase
npx prisma db push
```

### 5. (Opcjonalnie) Skonfiguruj webhook Clerk
W Clerk Dashboard:
- Idź do Webhooks
- Dodaj endpoint: `https://twoja-domena.com/api/webhooks/clerk`
- Wybierz eventy: user.created, user.updated, user.deleted
- Skopiuj signing secret i dodaj do `.env.local`:
```env
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxx
```

### 6. Sprawdź połączenie
```bash
# Otwórz Prisma Studio aby zobaczyć tabele
npx prisma studio
```

## 🎯 Gotowe!
Twoja baza danych jest teraz skonfigurowana i gotowa do użycia.

## Struktura tabel:
- **users** - przechowuje dane użytkowników z Clerk
- **searches** - historia wyszukiwań
- **videos** - dane o filmach YouTube (tytuł, transkrypcja, podsumowanie AI)
- **favorites** - ulubione filmy użytkowników

## Pomocne komendy:
```bash
# Reset bazy danych
npx prisma db push --force-reset

# Migracje (dla produkcji)
npx prisma migrate dev --name init

# Podgląd bazy
npx prisma studio
```