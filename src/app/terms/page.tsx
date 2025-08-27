export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Warunki Korzystania z Usługi</h1>
      <p className="text-gray-600 mb-8">Data wejścia w życie: {new Date().toLocaleDateString('pl-PL')}</p>

      <div className="prose prose-gray max-w-none">
        <h2>1. Akceptacja warunków</h2>
        <p>
          Korzystając z aplikacji ReadTube, akceptujesz niniejsze Warunki Korzystania z Usługi. 
          Jeśli nie zgadzasz się z tymi warunkami, nie korzystaj z naszej aplikacji.
        </p>

        <h2>2. Opis usługi</h2>
        <p>
          ReadTube to aplikacja umożliwiająca:
        </p>
        <ul>
          <li>Analizowanie filmów YouTube za pomocą sztucznej inteligencji</li>
          <li>Generowanie podsumowań i transkrypcji</li>
          <li>Zapisywanie analizowanych treści w bibliotece użytkownika</li>
          <li>Dostęp do napisów i metadanych filmów YouTube (tylko odczyt)</li>
        </ul>

        <h2>3. Konto użytkownika</h2>
        <h3>3.1 Rejestracja:</h3>
        <ul>
          <li>Wymagane jest konto Google do korzystania z usługi</li>
          <li>Musisz podać prawdziwe i aktualne informacje</li>
          <li>Jesteś odpowiedzialny za bezpieczeństwo swojego konta</li>
        </ul>

        <h3>3.2 Autoryzacja YouTube:</h3>
        <ul>
          <li>Aplikacja wymaga autoryzacji dostępu do YouTube (tylko odczyt)</li>
          <li>Możesz odwołać autoryzację w dowolnym momencie</li>
          <li>Nie modyfikujemy zawartości na Twoim kanale YouTube</li>
        </ul>

        <h2>4. Dopuszczalne użycie</h2>
        <h3>4.1 Możesz:</h3>
        <ul>
          <li>Analizować filmy YouTube do celów osobistych i edukacyjnych</li>
          <li>Zapisywać i organizować swoje analizy</li>
          <li>Udostępniać linki do analizowanych filmów</li>
        </ul>

        <h3>4.2 Nie możesz:</h3>
        <ul>
          <li>Wykorzystywać usługi do celów nielegalnych</li>
          <li>Naruszać praw autorskich lub innych praw własności intelektualnej</li>
          <li>Próbować uzyskać nieautoryzowany dostęp do systemu</li>
          <li>Używać automatycznych narzędzi do masowego przetwarzania</li>
          <li>Odsprzedawać lub komercyjnie wykorzystywać usługę bez zgody</li>
        </ul>

        <h2>5. Prawa własności intelektualnej</h2>
        <ul>
          <li>Aplikacja ReadTube jest chroniona prawami autorskimi</li>
          <li>Treści generowane przez AI na podstawie Twoich filmów należą do Ciebie</li>
          <li>Respektujemy prawa autorskie treści YouTube</li>
          <li>Analizujemy tylko publicznie dostępne filmy</li>
        </ul>

        <h2>6. Ograniczenie odpowiedzialności</h2>
        <p>
          ReadTube świadczy usługi "tak jak są". Nie gwarantujemy:
        </p>
        <ul>
          <li>100% dokładności generowanych podsumowań</li>
          <li>Ciągłej dostępności usługi</li>
          <li>Braku błędów w transkrypcjach</li>
        </ul>

        <p>
          Nie ponosimy odpowiedzialności za szkody wynikające z korzystania z aplikacji, 
          w tym utratę danych lub przerwy w działaniu.
        </p>

        <h2>7. Zgodność z YouTube Terms of Service</h2>
        <p>
          Korzystając z ReadTube, zgadzasz się również przestrzegać:
        </p>
        <ul>
          <li>Warunków korzystania z YouTube</li>
          <li>Zasad społeczności YouTube</li>
          <li>Google APIs Terms of Service</li>
        </ul>

        <h2>8. Zawieszenie i zakończenie</h2>
        <p>
          Możemy zawiesić lub zakończyć Twój dostęp do usługi w przypadku:
        </p>
        <ul>
          <li>Naruszenia niniejszych warunków</li>
          <li>Używania usługi w sposób szkodliwy</li>
          <li>Żądania ze strony organów prawnych</li>
        </ul>

        <h2>9. Zmiany w warunkach</h2>
        <p>
          Zastrzegamy sobie prawo do zmiany niniejszych warunków. 
          O istotnych zmianach powiadomimy użytkowników z wyprzedzeniem.
        </p>

        <h2>10. Prawo właściwe</h2>
        <p>
          Niniejsze warunki podlegają prawu polskiemu. 
          Wszelkie spory będą rozstrzygane przez sądy polskie.
        </p>

        <h2>11. Kontakt</h2>
        <p>
          W sprawach dotyczących warunków korzystania:
        </p>
        <p>
          Email: <a href="mailto:mateusz.lukowski3@gmail.com" className="text-blue-600">
            mateusz.lukowski3@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}