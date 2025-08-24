# YouTube OAuth2 Setup - Instrukcje Google Cloud Console

Oto dokładne kroki konfiguracji YouTube OAuth2 w Google Cloud Console, aby umożliwić aplikacji dostęp do oficjalnych napisów YouTube.

## 🎯 Co robimy

Rozszerzamy Twojego istniejącego OAuth2 klienta o scope YouTube, aby aplikacja mogła:
- Pobierać listę dostępnych napisów dla filmów YouTube
- Pobierać oficjalne napisy w różnych formatach (SRT, VTT, SBV)
- Uzyskać lepszą jakość transkrypcji bez bot detection

## 📋 Kroki konfiguracji

### 1. Otwórz Google Cloud Console

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Wybierz swój projekt (ten sam gdzie masz obecnie skonfigurowany OAuth2)

### 2. Włącz YouTube Data API v3

1. W menu bocznym kliknij **APIs & Services** → **Library**
2. Wyszukaj "YouTube Data API v3"
3. Kliknij na API i naciśnij **Enable**
4. Poczekaj aż API zostanie włączone

### 3. Skonfiguruj OAuth2 Client

1. W menu bocznym kliknij **APIs & Services** → **Credentials**
2. Znajdź swój istniejący **OAuth 2.0 Client ID** (prawdopodobnie nazywa się coś jak "Web client 1")
3. Kliknij na nazwę klienta, aby go edytować

### 4. Dodaj Redirect URIs

W sekcji **Authorized redirect URIs** dodaj:

```
https://twoja-domena.vercel.app/api/youtube-auth/callback
http://localhost:3000/api/youtube-auth/callback
```

**Zamień `twoja-domena.vercel.app` na rzeczywistą domenę Twojej aplikacji.**

**Ważne:** Jeśli masz już redirect URIs dla logowania, po prostu **dodaj** nowe, nie usuwaj istniejących.

### 5. Zapisz konfigurację

1. Kliknij **Save** na dole strony
2. Skopiuj **Client ID** i **Client Secret** (będą potrzebne w kroku 6)

### 6. Zaktualizuj zmienne środowiskowe

W pliku `.env` dodaj lub zaktualizuj:

```env
# Google OAuth2 (jeśli jeszcze nie masz)
GOOGLE_CLIENT_ID=twoj_google_client_id
GOOGLE_CLIENT_SECRET=twoj_google_client_secret

# YouTube API (już masz)
YOUTUBE_API_KEY=twoj_youtube_api_key

# NextAuth URL (już prawdopodobnie masz)
NEXTAUTH_URL=https://twoja-domena.vercel.app
# lub dla developmentu:
# NEXTAUTH_URL=http://localhost:3000
```

### 7. Zastosuj migrację bazy danych

Uruchom w terminalu:

```bash
npx prisma db push
```

To stworzy tabelę `youtube_auth` w bazie danych.

## 🧪 Testowanie

1. **Deploy aplikacji** na Vercel (jeśli jeszcze nie)
2. **Przejdź do aplikacji** i spróbuj przeanalizować film YouTube
3. **Powinna pojawić się opcja autoryzacji YouTube** - kliknij "Autoryzuj YouTube"
4. **Zostaniesz przekierowany** do Google gdzie zaakceptujesz uprawnienia
5. **Po powrocie** aplikacja będzie miała dostęp do oficjalnych napisów

## ❓ Rozwiązywanie problemów

### Problem: "redirect_uri_mismatch"
**Rozwiązanie:** Sprawdź czy redirect URI w Google Cloud Console jest dokładnie taki sam jak w aplikacji.

### Problem: "access_denied"
**Rozwiązanie:** Upewnij się że YouTube Data API v3 jest włączone w projekcie.

### Problem: "invalid_client"
**Rozwiązanie:** Sprawdź czy GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET są poprawne w .env.

### Problem: Brak przycisku autoryzacji
**Rozwiązanie:** Sprawdź czy komponent YouTubeAuth jest dodany do UI (będę to robić w następnym kroku).

## 🎉 Po konfiguracji

Po poprawnej konfiguracji:
- **Strategy 1** będzie używać OAuth2 YouTube (najwyższa jakość)
- **Strategy 2** będzie używać API key YouTube (ograniczona)
- **Strategy 3** będzie używać nieoficjalne napisy
- **Strategy 4** będzie używać audio extraction (ostateczność)

Aplikacja automatycznie wybierze najlepszą dostępną metodę!

---

**💡 Wskazówka:** Zachowaj kopię tej instrukcji - może się przydać w przyszłości przy aktualizacjach lub przenoszeniu na inne środowiska.