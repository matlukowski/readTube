/**
 * Utility functions for formatting and cleaning YouTube transcripts
 */

// Common filler words and sounds in multiple languages
const FILLER_WORDS = [
  // English
  'uhh', 'umm', 'uh', 'um', 'err', 'ah', 'eh', 'hmm', 'mhm', 'yeah', 'like',
  // Sounds
  'aaaa', 'aaa', 'aa', 'eee', 'ee', 'yyy', 'yy', 'ooo', 'oo', 'mmm', 'mm',
  // Polish  
  'eee', 'yyy', 'mmm', 'no', 'tak', 'znaczy', 'wiesz',
  // Generic patterns
  'hm', 'hah', 'heh', 'oh', 'ahh', 'ehh', 'ihh', 'ohh', 'uhh'
];

/**
 * Removes filler words and sounds from transcript
 */
export function cleanFillerWords(text: string): string {
  if (!text) return '';

  let cleaned = text;
  
  // Create regex pattern for filler words (case insensitive, word boundaries)
  const fillerPattern = new RegExp(
    `\\b(${FILLER_WORDS.join('|')})\\b`,
    'gi'
  );
  
  // Remove filler words
  cleaned = cleaned.replace(fillerPattern, '');
  
  // Remove standalone repeated characters (e.g., "a a a", "e e e")
  cleaned = cleaned.replace(/\b[aeiou]\s+[aeiou]\s+[aeiou]\b/gi, '');
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Formats text into readable paragraphs
 */
export function formatParagraphs(text: string): string[] {
  if (!text) return [];

  // Split on common sentence endings followed by space and capital letter
  let sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  
  // If no proper sentences found, split on periods
  if (sentences.length === 1) {
    sentences = text.split(/\.\s+/);
  }
  
  // Group sentences into paragraphs (3-5 sentences per paragraph)
  const paragraphs: string[] = [];
  const sentencesPerParagraph = 4;
  
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph);
    const paragraph = paragraphSentences.join(' ').trim();
    
    if (paragraph.length > 0) {
      paragraphs.push(paragraph);
    }
  }
  
  return paragraphs.length > 0 ? paragraphs : [text];
}

/**
 * Adds basic punctuation based on pauses and context
 */
export function addPunctuation(text: string): string {
  if (!text) return '';

  let formatted = text;
  
  // Add periods at the end of sentences that don't have punctuation
  formatted = formatted.replace(/([a-z])\s+([A-Z])/g, '$1. $2');
  
  // Add period at the end if missing
  if (!/[.!?]$/.test(formatted.trim())) {
    formatted = formatted.trim() + '.';
  }
  
  // Fix spacing around punctuation
  formatted = formatted.replace(/\s+([.!?])/g, '$1');
  formatted = formatted.replace(/([.!?])([A-Za-z])/g, '$1 $2');
  
  return formatted;
}

/**
 * Highlights important keywords and phrases
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  // Common important word patterns
  const keywordPatterns = [
    // Technical terms
    /\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g, // CamelCase words
    // Repeated important words
    /\b\w{6,}\b/g, // Words longer than 6 characters
  ];

  const keywords = new Set<string>();
  
  keywordPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      if (match.length > 3 && !FILLER_WORDS.includes(match.toLowerCase())) {
        keywords.add(match);
      }
    });
  });

  return Array.from(keywords).slice(0, 10); // Top 10 keywords
}

/**
 * Main function to format transcript with all improvements
 */
export function formatTranscript(rawTranscript: string): {
  cleanedText: string;
  paragraphs: string[];
  keywords: string[];
  wordCount: number;
  readingTime: number; // in minutes
} {
  if (!rawTranscript) {
    return {
      cleanedText: '',
      paragraphs: [],
      keywords: [],
      wordCount: 0,
      readingTime: 0
    };
  }

  // Step 1: Clean filler words
  const cleaned = cleanFillerWords(rawTranscript);
  
  // Step 2: Add punctuation
  const punctuated = addPunctuation(cleaned);
  
  // Step 3: Format into paragraphs
  const paragraphs = formatParagraphs(punctuated);
  
  // Step 4: Extract keywords
  const keywords = extractKeywords(punctuated);
  
  // Step 5: Calculate stats
  const wordCount = punctuated.split(/\s+/).filter(word => word.length > 0).length;
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words per minute
  
  return {
    cleanedText: punctuated,
    paragraphs,
    keywords,
    wordCount,
    readingTime
  };
}

/**
 * Search function for finding text in transcript
 */
export function searchInTranscript(transcript: string, query: string): {
  matches: number;
  highlightedText: string;
} {
  if (!transcript || !query) {
    return { matches: 0, highlightedText: transcript };
  }

  const regex = new RegExp(`(${query})`, 'gi');
  const matches = (transcript.match(regex) || []).length;
  const highlightedText = transcript.replace(regex, '<mark>$1</mark>');

  return { matches, highlightedText };
}