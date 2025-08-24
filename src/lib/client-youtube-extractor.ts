// Client-side YouTube transcript extractor
// This runs in the browser to avoid YouTube blocking server IPs

interface CaptionTrack {
  baseUrl: string;
  name: {
    simpleText: string;
  };
  vssId: string;
  languageCode: string;
  kind?: string;
  isTranslatable: boolean;
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

export class ClientYouTubeExtractor {
  private preferredLanguages = ['pl', 'pl-PL', 'en', 'en-US', 'en-GB'];

  async extractTranscript(videoId: string): Promise<string | null> {
    try {
      console.log(`🚀 Starting client-side transcript extraction for ${videoId}`);
      
      // Step 1: Fetch YouTube page (try direct first, then proxy if CORS issue)
      const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let response: Response;
      let html: string;
      
      try {
        // Try direct fetch first
        response = await fetch(pageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch YouTube page: ${response.status}`);
        }
        html = await response.text();
      } catch {
        // If CORS error, try through proxy
        console.log('Direct fetch failed, trying proxy...');
        const proxyUrl = `/api/proxy/youtube?url=${encodeURIComponent(pageUrl)}`;
        response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch YouTube page via proxy: ${response.status}`);
        }
        html = await response.text();
      }
      
      console.log(`📄 Retrieved HTML: ${html.length} characters`);

      // Step 2: Extract player response from HTML
      const playerResponse = this.extractPlayerResponse(html);
      if (!playerResponse) {
        throw new Error('Could not extract player data from YouTube page');
      }

      // Step 3: Get caption tracks
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        console.log(`⚠️ No captions available for video ${videoId}`);
        return null;
      }

      // Step 4: Select best caption track
      const selectedTrack = this.selectBestTrack(captionTracks);
      if (!selectedTrack) {
        console.log(`❌ No suitable caption track found`);
        return null;
      }

      // Step 5: Fetch transcript XML
      const xmlContent = await this.fetchCaptions(selectedTrack.baseUrl);
      
      // Step 6: Parse XML to text
      const transcript = this.parseTranscriptXML(xmlContent);
      
      if (!transcript || transcript.length === 0) {
        console.log(`⚠️ Transcript is empty`);
        return null;
      }

      console.log(`✅ Successfully extracted transcript: ${transcript.length} characters`);
      return transcript;

    } catch (error) {
      console.error(`❌ Client-side extraction failed:`, error);
      throw error;
    }
  }

  private extractPlayerResponse(html: string): YouTubePlayerResponse | null {
    try {
      // Try multiple patterns that YouTube uses
      const patterns = [
        /ytInitialPlayerResponse\s*=\s*({.+?});/,
        /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/,
        /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/,
        /ytInitialPlayerResponse\s*=\s*\(\s*\(\s*\)\s*=>\s*({.+?})\s*\)\s*\(\s*\)/
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          try {
            return JSON.parse(match[1]);
          } catch (parseError) {
            console.warn('Failed to parse match:', parseError);
            continue;
          }
        }
      }

      // Fallback: Try to find it in a script tag
      const scriptRegex = new RegExp('<script[^>]*>.*?ytInitialPlayerResponse[^<]*<\\/script>', 'g');
      const scriptMatch = html.match(scriptRegex);
      if (scriptMatch) {
        for (const script of scriptMatch) {
          for (const pattern of patterns) {
            const match = script.match(pattern);
            if (match && match[1]) {
              try {
                return JSON.parse(match[1]);
              } catch {
                continue;
              }
            }
          }
        }
      }

      console.warn('No ytInitialPlayerResponse found');
      return null;
    } catch (error) {
      console.error('Failed to extract player response:', error);
      return null;
    }
  }

  private selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
    if (!tracks || tracks.length === 0) return null;

    console.log(`📋 Available tracks: ${tracks.map(t => `${t.languageCode}(${t.kind || 'manual'})`).join(', ')}`);

    // Try preferred languages first
    for (const lang of this.preferredLanguages) {
      // Prefer manual captions
      const manualTrack = tracks.find(t => 
        t.languageCode === lang && (!t.kind || t.kind === '')
      );
      if (manualTrack) {
        console.log(`✅ Found manual captions for: ${lang}`);
        return manualTrack;
      }

      // Then auto-generated
      const autoTrack = tracks.find(t => 
        t.languageCode === lang && t.kind === 'asr'
      );
      if (autoTrack) {
        console.log(`✅ Found auto-generated captions for: ${lang}`);
        return autoTrack;
      }
    }

    // Fallback to any available track
    const anyTrack = tracks.find(t => t.kind === 'asr') || tracks[0];
    console.log(`⚠️ Using fallback track: ${anyTrack.languageCode}`);
    return anyTrack;
  }

  private async fetchCaptions(baseUrl: string): Promise<string> {
    try {
      console.log(`📥 Fetching captions from YouTube...`);
      
      // Add format parameter for better compatibility
      const url = baseUrl.includes('?') 
        ? `${baseUrl}&fmt=srv3` 
        : `${baseUrl}?fmt=srv3`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlContent = await response.text();
      console.log(`✅ Retrieved caption data: ${xmlContent.length} characters`);
      
      return xmlContent;
    } catch (error) {
      console.error('Failed to fetch captions:', error);
      throw error;
    }
  }

  private parseTranscriptXML(xmlContent: string): string {
    try {
      // Parse XML without external dependencies (browser native)
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parse errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parse error:', parseError.textContent);
        return '';
      }

      // Extract text elements
      const textElements = xmlDoc.querySelectorAll('text');
      const segments: string[] = [];

      textElements.forEach(element => {
        const text = element.textContent || '';
        if (text.trim()) {
          segments.push(text.trim());
        }
      });

      console.log(`📝 Parsed ${segments.length} transcript segments`);

      // Join and clean the text
      const transcript = segments
        .join(' ')
        .replace(/\[.*?\]/g, '')     // Remove [Music], [Applause], etc.
        .replace(/\(.*?\)/g, '')     // Remove (background noise), etc.
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      return transcript;
    } catch (error) {
      console.error('Failed to parse transcript XML:', error);
      return '';
    }
  }

  // Retry mechanism for reliability
  async extractWithRetry(videoId: string, maxRetries: number = 3): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${videoId}`);
        
        const result = await this.extractTranscript(videoId);
        if (result) {
          return result;
        }
        
        // If no transcript found (not an error), don't retry
        if (attempt === 1) {
          console.log(`ℹ️ No captions available for ${videoId}`);
          return null;
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`⚠️ Attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏱️ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All caption extraction attempts failed');
  }

  // Check if audio extraction might be needed as fallback
  async checkAudioFallbackAvailability(videoId: string): Promise<{available: boolean, reason?: string}> {
    try {
      console.log(`🔍 Checking audio fallback availability for ${videoId}...`);
      
      const response = await fetch(`/api/audio-extract?id=${videoId}`);
      
      if (!response.ok) {
        return { available: false, reason: 'API check failed' };
      }
      
      const result = await response.json();
      
      if (!result.available) {
        return { available: false, reason: result.error || 'Audio not available' };
      }
      
      if (result.tooLong) {
        return { available: false, reason: 'Video too long for audio transcription' };
      }
      
      return { available: true };
      
    } catch (error) {
      console.error('❌ Audio availability check failed:', error);
      return { available: false, reason: 'Check failed' };
    }
  }
}

// Export singleton instance for easy use
export const youtubeExtractor = new ClientYouTubeExtractor();