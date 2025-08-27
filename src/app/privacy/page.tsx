export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Polityka Prywatności</h1>
      <p className="text-gray-600 mb-8">Data wejścia w życie: {new Date().toLocaleDateString('pl-PL')}</p>

      <div className="prose prose-gray max-w-none">
        <h2>1. Informacje ogólne</h2>
        <p>
          ReadTube ("my", "nas", "nasz") szanuje Twoją prywatność i zobowiązuje się do ochrony 
          Twoich danych osobowych. Niniejsza polityka prywatności wyjaśnia, jak zbieramy, 
          używamy i chronimy Twoje informacje podczas korzystania z naszej aplikacji.
        </p>

        <h2>2. Jakie dane zbieramy</h2>
        <h3>2.1 Dane Google OAuth:</h3>
        <ul>
          <li>Adres email</li>
          <li>Imię i nazwisko</li>
          <li>Zdjęcie profilowe</li>
          <li>Identyfikator Google</li>
        </ul>

        <h3>2.2 Dane YouTube (tylko odczyt):</h3>
        <ul>
          <li>Dostęp do informacji o koncie YouTube</li>
          <li>Możliwość odczytu napisów i metadanych filmów</li>
          <li><strong>Nie mamy dostępu do edycji, usuwania lub dodawania zawartości</strong></li>
        </ul>

        <h3>2.3 Dane użytkowania:</h3>
        <ul>
          <li>Linki do analizowanych filmów YouTube</li>
          <li>Generowane podsumowania i transkrypcje</li>
          <li>Historia analizowanych filmów</li>
        </ul>

        <h2>3. Jak wykorzystujemy dane</h2>
        <ul>
          <li>Autoryzacja i uwierzytelnianie użytkowników</li>
          <li>Pobieranie napisów z filmów YouTube</li>
          <li>Generowanie podsumowań AI</li>
          <li>Przechowywanie historii analizowanych filmów</li>
          <li>Usprawnianie działania aplikacji</li>
        </ul>

        <h2>4. Udostępnianie danych</h2>
        <p>
          <strong>Nie sprzedajemy, nie wynajmujemy ani nie udostępniamy</strong> Twoich danych osobowych 
          stronom trzecim, z wyjątkiem następujących przypadków:
        </p>
        <ul>
          <li>Gdy jesteś wyraźnie na to zgodny</li>
          <li>Gdy wymagają tego przepisy prawa</li>
          <li>Zewnętrzne usługi niezbędne do działania aplikacji (Google API, OpenAI)</li>
        </ul>

        <h2>5. Bezpieczeństwo danych</h2>
        <p>
          Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony 
          Twoich danych przed nieuprawnionym dostępem, utratą lub zniszczeniem.
        </p>

        <h2>6. Twoje prawa</h2>
        <p>Masz prawo do:</p>
        <ul>
          <li>Dostępu do swoich danych</li>
          <li>Sprostowania nieprawidłowych danych</li>
          <li>Usunięcia swoich danych</li>
          <li>Ograniczenia przetwarzania</li>
          <li>Przenoszenia danych</li>
          <li>Odwołania zgody w dowolnym momencie</li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          Aplikacja używa localStorage do przechowywania tokenów autoryzacji 
          i preferencji użytkownika lokalnie w Twojej przeglądarce.
        </p>

        <h2>8. Kontakt</h2>
        <p>
          W sprawach dotyczących prywatności, skontaktuj się z nami:
        </p>
        <p>
          Email: <a href="mailto:mateusz.lukowski3@gmail.com" className="text-blue-600">
            mateusz.lukowski3@gmail.com
          </a>
        </p>

        <h2>9. Zmiany w polityce prywatności</h2>
        <p>
          Zastrzegamy sobie prawo do aktualizacji niniejszej polityki prywatności. 
          O istotnych zmianach będziemy informować użytkowników.
        </p>
      </div>
    </div>
  );
}