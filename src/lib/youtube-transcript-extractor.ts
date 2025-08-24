import { XMLParser } from 'fast-xml-parser';

interface CaptionTrack {
  baseUrl: string;
  name: {
    simpleText: string;
  };
  vssId: string;
  languageCode: string;
  kind?: string; // "asr" for auto-generated, undefined for manual
  isTranslatable: boolean;
}

interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

interface YouTubePlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
      audioTracks?: unknown[];
      translationLanguages?: unknown[];
    };
  };
}

// Extract ytInitialPlayerResponse from YouTube HTML
function extractPlayerResponse(html: string): YouTubePlayerResponse | null {
  try {
    // Try different patterns YouTube uses
    const patterns = [
      /ytInitialPlayerResponse\s*=\s*({.+?});/,
      /var ytInitialPlayerResponse\s*=\s*({.+?});/,
      /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
    }

    console.warn('No ytInitialPlayerResponse found in HTML');
    return null;
  } catch (error) {
    console.error('Failed to parse ytInitialPlayerResponse:', error);
    return null;
  }
}

// Select best caption track based on language preferences
function selectBestTrack(tracks: CaptionTrack[], preferredLanguages: string[]): CaptionTrack | null {
  if (!tracks || tracks.length === 0) {
    return null;
  }

  console.log(`📋 Available tracks: ${tracks.map(t => `${t.languageCode}(${t.kind || 'manual'})`).join(', ')}`);

  // Try preferred languages first
  for (const lang of preferredLanguages) {
    // Try manual captions first
    const manualTrack = tracks.find(t => 
      t.languageCode === lang && (!t.kind || t.kind === '')
    );
    if (manualTrack) {
      console.log(`✅ Found manual captions for language: ${lang}`);
      return manualTrack;
    }

    // Then try auto-generated
    const autoTrack = tracks.find(t => 
      t.languageCode === lang && t.kind === 'asr'
    );
    if (autoTrack) {
      console.log(`✅ Found auto-generated captions for language: ${lang}`);
      return autoTrack;
    }
  }

  // Fallback: any auto-generated track
  const anyAutoTrack = tracks.find(t => t.kind === 'asr');
  if (anyAutoTrack) {
    console.log(`⚠️ Using fallback auto-generated track: ${anyAutoTrack.languageCode}`);
    return anyAutoTrack;
  }

  // Last resort: any track
  const anyTrack = tracks[0];
  console.log(`⚠️ Using last resort track: ${anyTrack.languageCode} (${anyTrack.kind || 'manual'})`);
  return anyTrack;
}

// Fetch transcript XML from timedtext endpoint
async function fetchTimedtext(baseUrl: string): Promise<string> {
  try {
    console.log(`📥 Fetching captions from: ${baseUrl}`);
    
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
        'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlContent = await response.text();
    console.log(`✅ Retrieved XML content: ${xmlContent.length} characters`);
    
    return xmlContent;
  } catch (error) {
    console.error('Failed to fetch timedtext:', error);
    throw error;
  }
}

// Parse XML content to clean text transcript
function parseTimedtextXML(xmlContent: string): TranscriptSnippet[] {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      textNodeName: '#text'
    });

    const parsed = parser.parse(xmlContent);
    
    // Handle both single text element and array of text elements
    let textElements = parsed?.transcript?.text;
    if (!textElements) {
      console.warn('No text elements found in XML');
      return [];
    }

    // Ensure it's always an array
    if (!Array.isArray(textElements)) {
      textElements = [textElements];
    }

    const snippets: TranscriptSnippet[] = textElements.map((element: { [key: string]: string | number }) => ({
      text: (element['#text'] || element.text || '').toString().trim(),
      start: parseFloat(String(element.start || '0')),
      duration: parseFloat(String(element.dur || element.duration || '0'))
    })).filter((snippet: TranscriptSnippet) => snippet.text.length > 0);

    console.log(`📝 Parsed ${snippets.length} transcript snippets`);
    return snippets;
  } catch (error) {
    console.error('Failed to parse XML:', error);
    return [];
  }
}

// Convert snippets to clean text
function snippetsToText(snippets: TranscriptSnippet[]): string {
  const text = snippets
    .map(snippet => snippet.text)
    .join(' ')
    .replace(/\[.*?\]/g, '')     // Remove [Music], [Applause], etc.
    .replace(/\(.*?\)/g, '')     // Remove (background noise), etc.
    .replace(/&amp;/g, '&')     // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();

  return text;
}

// Main function to extract YouTube transcript
export async function getYouTubeTranscriptDirect(videoId: string): Promise<string | null> {
  try {
    console.log(`🚀 Starting direct transcript extraction for ${videoId}`);
    
    // Step 1: Fetch YouTube page
    console.log(`📡 Fetching YouTube page...`);
    const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`📄 Retrieved HTML: ${html.length} characters`);

    // Step 2: Extract player response
    const playerResponse = extractPlayerResponse(html);
    if (!playerResponse) {
      throw new Error('Could not extract ytInitialPlayerResponse from page');
    }

    console.log(`🎬 Extracted player response`);

    // Step 3: Get caption tracks
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
      console.log(`⚠️ No caption tracks found for video ${videoId}`);
      return null;
    }

    // Step 4: Select best track
    const preferredLanguages = ['pl', 'pl-PL', 'en', 'en-US', 'en-GB'];
    const selectedTrack = selectBestTrack(captionTracks, preferredLanguages);
    
    if (!selectedTrack) {
      console.log(`❌ No suitable caption track found`);
      return null;
    }

    // Step 5: Fetch transcript XML
    const xmlContent = await fetchTimedtext(selectedTrack.baseUrl);
    
    // Step 6: Parse XML to snippets
    const snippets = parseTimedtextXML(xmlContent);
    if (snippets.length === 0) {
      console.log(`⚠️ No transcript snippets parsed from XML`);
      return null;
    }

    // Step 7: Convert to clean text
    const transcript = snippetsToText(snippets);
    
    if (transcript.length === 0) {
      console.log(`⚠️ Transcript is empty after cleaning`);
      return null;
    }

    console.log(`✅ Successfully extracted transcript: ${transcript.length} characters`);
    console.log(`📝 Preview: ${transcript.substring(0, 200)}...`);
    
    return transcript;

  } catch (error) {
    console.error(`❌ Direct transcript extraction failed for ${videoId}:`, error);
    return null;
  }
}

// Fallback method with retry mechanism
export async function getYouTubeTranscriptWithRetry(videoId: string, retries: number = 3): Promise<string | null> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Transcript extraction attempt ${attempt}/${retries} for ${videoId}`);
      
      const result = await getYouTubeTranscriptDirect(videoId);
      if (result) {
        return result;
      }
      
      // If no transcript found (not an error), don't retry
      if (attempt === 1) {
        console.log(`ℹ️ No transcript available for ${videoId}, not retrying`);
        return null;
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`⚠️ Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.log(`⏱️ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All transcript extraction attempts failed');
}