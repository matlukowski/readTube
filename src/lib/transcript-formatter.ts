/**
 * Transcript Formatter Utility
 * Formatuje surowe transkrypcje z Gladia API dla lepszej czytelności i użycia z AI
 */

export interface TimestampSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface FormattedTranscript {
  formatted: string;
  paragraphs: string[];
  wordCount: number;
  estimatedReadTime: number; // in minutes
  hasTimestamps: boolean;
  speakers?: string[];
}

/**
 * Zaawansowane usuwanie powtórzeń z transkrypcji Gladia API
 * Obsługuje różne typy repetycji: słowa, frazy, zdania
 */
function removeAdvancedRepetitions(text: string): string {
  if (!text || text.trim().length === 0) return text;

  let cleanedText = text;

  // Etap 1: Usuń proste powtórzenia słów (word word -> word)
  cleanedText = cleanedText.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Etap 2: Usuń powtórzenia fraz (2-8 słów)
  for (let phraseLength = 2; phraseLength <= 8; phraseLength++) {
    const regex = new RegExp(
      `\\b((?:\\w+\\s+){${phraseLength - 1}}\\w+)\\s+\\1\\b`,
      'gi'
    );
    cleanedText = cleanedText.replace(regex, '$1');
  }

  // Etap 3: Usuń podobne zdania (algorytm sliding window)
  const sentences = cleanedText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Tylko dłuższe zdania

  const uniqueSentences: string[] = [];
  const seenSentences = new Set<string>();

  for (const sentence of sentences) {
    const normalized = normalizeSentenceForComparison(sentence);
    
    // Sprawdź czy to zdanie lub bardzo podobne już wystąpiło
    let isDuplicate = false;
    for (const seen of seenSentences) {
      if (calculateSimilarity(normalized, seen) > 0.85) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueSentences.push(sentence);
      seenSentences.add(normalized);
    }
  }

  // Etap 4: Połącz unikalne zdania z powrotem
  cleanedText = uniqueSentences.join('. ');

  // Etap 5: Usuń nadmiarowe spacje wokół "i" i "oraz"
  cleanedText = cleanedText.replace(/\s+(i|oraz)\s+/gi, ' $1 ');

  // Etap 6: Ostateczne czyszczenie
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/\s*[.!?]\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .trim();

  return cleanedText;
}

/**
 * Normalizuje zdanie dla porównania podobieństwa
 */
function normalizeSentenceForComparison(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Usuń interpunkcję
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Oblicza podobieństwo między dwoma zdaniami (Jaccard similarity)
 * Zwraca wartość 0-1, gdzie 1 = identyczne
 */
function calculateSimilarity(sentence1: string, sentence2: string): number {
  const words1 = new Set(sentence1.split(/\s+/));
  const words2 = new Set(sentence2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Formatuje transkrypcję dla wyświetlania użytkownikowi
 * - Czyści nadmiarowe spacje i powtórzenia (ulepszone algorytmy)
 * - Dzieli na paragrafy
 * - Dodaje interpunkcję
 * - Oblicza statystyki
 */
export function formatTranscriptForDisplay(rawTranscript: string): FormattedTranscript {
  if (!rawTranscript || rawTranscript.trim().length === 0) {
    return {
      formatted: '',
      paragraphs: [],
      wordCount: 0,
      estimatedReadTime: 0,
      hasTimestamps: false,
      speakers: []
    };
  }

  // Etap 1: Podstawowe czyszczenie tekstu
  let cleanText = rawTranscript
    // Usuń nadmiarowe spacje i znaki nowej linii
    .replace(/\s+/g, ' ')
    // Usuń niepotrzebne znaki interpunkcyjne
    .replace(/[\.]{2,}/g, '.')
    .replace(/[,]{2,}/g, ',')
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?')
    // Popraw interpunkcję po cyfrach
    .replace(/(\d+)([a-zA-Z])/g, '$1 $2')
    // Usuń pojedyncze litery stojące samotnie (często artefakty)
    .replace(/\s+[a-zA-Z]\s+/g, ' ')
    .trim();

  // Etap 2: Zaawansowane usuwanie powtórzeń
  cleanText = removeAdvancedRepetitions(cleanText);

  // Wykryj czy transkrypcja ma timestamps lub speaker labels
  const hasTimestamps = /\d{1,2}:\d{2}/.test(cleanText);
  const speakerPattern = /Speaker \d+:|Mówca \d+:/gi;
  const hasSpeakers = speakerPattern.test(cleanText);
  
  let speakers: string[] = [];
  if (hasSpeakers) {
    const speakerMatches = cleanText.match(speakerPattern);
    speakers = [...new Set(speakerMatches || [])];
  }

  // Usuń timestamps i speaker labels z tekstu finalnego
  cleanText = cleanText
    .replace(/\d{1,2}:\d{2}:\d{2}/g, '') // Usuń timestamps
    .replace(speakerPattern, '') // Usuń speaker labels
    .replace(/\s+/g, ' ')
    .trim();

  // Podziel na zdania dla lepszego formatowania
  const sentences = cleanText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Utwórz paragrafy (co około 3-5 zdań lub 100-150 słów)
  const paragraphs: string[] = [];
  let currentParagraph = '';
  let wordCount = 0;
  const targetWordsPerParagraph = 120;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    
    if (wordCount + sentenceWords > targetWordsPerParagraph && currentParagraph.length > 0) {
      // Zakończ bieżący paragraf
      paragraphs.push(currentParagraph.trim() + '.');
      currentParagraph = sentence;
      wordCount = sentenceWords;
    } else {
      // Dodaj do bieżącego paragrafu
      currentParagraph += (currentParagraph ? '. ' : '') + sentence;
      wordCount += sentenceWords;
    }
  }

  // Dodaj ostatni paragraf
  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim() + '.');
  }

  // Stwórz sformatowany tekst
  const formatted = paragraphs.join('\n\n');
  const totalWords = formatted.split(/\s+/).length;
  
  // Oszacuj czas czytania (średnio 200 słów na minutę)
  const estimatedReadTime = Math.ceil(totalWords / 200);

  return {
    formatted,
    paragraphs,
    wordCount: totalWords,
    estimatedReadTime,
    hasTimestamps,
    speakers: hasSpeakers ? speakers : undefined
  };
}

/**
 * Formatuje transkrypcję dla kontekstu AI (OpenAI)
 * - Zachowuje pełną treść ale usuwa powtórzenia
 * - Czyści szum i artefakty Gladia API
 * - Optymalizuje dla tokenów
 */
export function formatTranscriptForAI(rawTranscript: string): string {
  if (!rawTranscript || rawTranscript.trim().length === 0) {
    return '';
  }

  let cleanedText = rawTranscript
    // Podstawowe czyszczenie
    .replace(/\s+/g, ' ')
    // Usuń timestamps jeśli są niepotrzebne dla kontekstu
    .replace(/\d{1,2}:\d{2}:\d{2}/g, '')
    // Usuń speaker labels (AI nie potrzebuje tego do zrozumienia treści)
    .replace(/Speaker \d+:|Mówca \d+:/gi, '')
    // Normalizuj interpunkcję
    .replace(/[\.]{2,}/g, '.')
    .replace(/[,]{2,}/g, ',')
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?')
    .trim();

  // Użyj zaawansowanego usuwania powtórzeń (ale zachowaj więcej kontekstu dla AI)
  cleanedText = removeAdvancedRepetitions(cleanedText);

  // Dodatkowe optymalizacje dla AI:
  // Usuń bardzo krótkie fragmenty które mogą być szumem
  const sentences = cleanedText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  
  return sentences.join('. ').trim();
}

/**
 * Wyodrębnia timestamps z transkrypcji jeśli są dostępne
 */
export function extractKeyTimestamps(transcript: string): TimestampSegment[] {
  const segments: TimestampSegment[] = [];
  
  // Wzorzec dla timestamps: HH:MM:SS lub MM:SS
  const timestampPattern = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*(.+?)(?=(?:\d{1,2}:)?\d{1,2}:\d{2}|$)/gi;
  let match;

  while ((match = timestampPattern.exec(transcript)) !== null) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const text = match[4]?.trim() || '';

    if (text.length > 0) {
      const startTime = hours * 3600 + minutes * 60 + seconds;
      
      segments.push({
        start: startTime,
        end: startTime + 30, // Domyślnie 30 sekund (może być lepiej oszacowane)
        text: text.replace(/Speaker \d+:|Mówca \d+:/gi, '').trim()
      });
    }
  }

  return segments;
}

/**
 * Konwertuje sekundy na format HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Generuje link do YouTube z timestamp
 */
export function createTimestampLink(youtubeId: string, timestamp: number): string {
  return `https://www.youtube.com/watch?v=${youtubeId}&t=${timestamp}s`;
}

/**
 * Wykrywa język transkrypcji (podstawowe wykrywanie)
 */
export function detectTranscriptLanguage(transcript: string): 'pl' | 'en' | 'unknown' {
  const cleanText = transcript.toLowerCase();
  
  // Polskie słowa charakterystyczne
  const polishWords = ['jest', 'że', 'nie', 'się', 'jako', 'już', 'tylko', 'jego', 'oraz', 'można'];
  const englishWords = ['the', 'and', 'you', 'that', 'this', 'with', 'for', 'are', 'have', 'not'];
  
  let polishCount = 0;
  let englishCount = 0;
  
  polishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    polishCount += (cleanText.match(regex) || []).length;
  });
  
  englishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    englishCount += (cleanText.match(regex) || []).length;
  });
  
  if (polishCount > englishCount) return 'pl';
  if (englishCount > polishCount) return 'en';
  return 'unknown';
}

/**
 * Tworzy excerpt (fragment) transkrypcji wokół określonego słowa/frazy
 */
export function createTranscriptExcerpt(
  transcript: string, 
  searchTerm: string, 
  contextWords: number = 20
): string {
  const words = transcript.split(/\s+/);
  const searchWords = searchTerm.toLowerCase().split(/\s+/);
  
  // Znajdź indeks pierwszego wystąpienia
  let foundIndex = -1;
  for (let i = 0; i <= words.length - searchWords.length; i++) {
    const slice = words.slice(i, i + searchWords.length).map(w => w.toLowerCase());
    if (slice.join(' ').includes(searchWords.join(' '))) {
      foundIndex = i;
      break;
    }
  }
  
  if (foundIndex === -1) {
    return ''; // Nie znaleziono
  }
  
  // Wyodrębnij kontekst
  const startIndex = Math.max(0, foundIndex - contextWords);
  const endIndex = Math.min(words.length, foundIndex + searchWords.length + contextWords);
  
  return words.slice(startIndex, endIndex).join(' ');
}

/**
 * Waliduje czy transkrypcja wygląda na prawidłową (nie jest szumem)
 */
export function validateTranscript(transcript: string): {
  isValid: boolean;
  issues: string[];
  quality: 'high' | 'medium' | 'low';
} {
  const issues: string[] = [];
  
  if (!transcript || transcript.trim().length < 50) {
    return { isValid: false, issues: ['Transkrypcja jest zbyt krótka'], quality: 'low' };
  }
  
  const wordCount = transcript.split(/\s+/).length;
  const charCount = transcript.length;
  const avgWordLength = charCount / wordCount;
  
  // Sprawdź różne problemy
  if (avgWordLength < 3) {
    issues.push('Słowa wydają się zbyt krótkie (możliwy szum)');
  }
  
  if (avgWordLength > 15) {
    issues.push('Słowa wydają się zbyt długie (możliwe połączone słowa)');
  }
  
  // Sprawdź powtarzające się frazy
  const sentences = transcript.split(/[.!?]+/);
  const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
  
  if (sentences.length > uniqueSentences.size * 1.5) {
    issues.push('Wiele powtarzających się fraz');
  }
  
  // Oceń jakość
  let quality: 'high' | 'medium' | 'low' = 'high';
  if (issues.length >= 2) quality = 'low';
  else if (issues.length === 1) quality = 'medium';
  
  return {
    isValid: issues.length < 2,
    issues,
    quality
  };
}