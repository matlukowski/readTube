/**
 * YouTube Data API v3 client for fetching official captions/transcripts
 * Uses official YouTube API to avoid bot detection issues
 */

interface YouTubeCaptionTrack {
  id: string;
  snippet: {
    language: string;
    name: string;
    audioTrackType?: string;
    isCC?: boolean;
    isLarge?: boolean;
    isEasyReader?: boolean;
    isDraft?: boolean;
    isAutoSynced?: boolean;
    status?: string;
  };
}

interface YouTubeCaptionList {
  items: YouTubeCaptionTrack[];
}

interface TranscriptEntry {
  text: string;
  start: number;
  duration: number;
}

/**
 * Convert caption format (SRT/VTT/SBV) to structured transcript
 */
function parseCaptionFormat(content: string, format: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  
  if (format === 'srt' || format === 'sbv') {
    // Parse SRT/SBV format
    const blocks = content.trim().split(/\n\s*\n/);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;
      
      // Parse timestamp line (SRT: 00:00:01,000 --> 00:00:04,000)
      const timestampLine = format === 'srt' ? lines[1] : lines[0];
      const timestampMatch = timestampLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
      
      if (timestampMatch) {
        const startTime = 
          parseInt(timestampMatch[1]) * 3600 +
          parseInt(timestampMatch[2]) * 60 +
          parseInt(timestampMatch[3]) +
          parseInt(timestampMatch[4]) / 1000;
          
        const endTime = 
          parseInt(timestampMatch[5]) * 3600 +
          parseInt(timestampMatch[6]) * 60 +
          parseInt(timestampMatch[7]) +
          parseInt(timestampMatch[8]) / 1000;
        
        // Get text (remaining lines)
        const textStartIndex = format === 'srt' ? 2 : 1;
        const text = lines.slice(textStartIndex).join(' ').trim();
        
        if (text) {
          entries.push({
            text,
            start: startTime,
            duration: endTime - startTime
          });
        }
      }
    }
  } else if (format === 'vtt') {
    // Parse WebVTT format
    const lines = content.split('\n');
    let i = 0;
    
    // Skip header
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }
    
    while (i < lines.length) {
      const line = lines[i];
      
      if (line.includes('-->')) {
        const timestampMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
        
        if (timestampMatch) {
          const startTime = 
            parseInt(timestampMatch[1]) * 3600 +
            parseInt(timestampMatch[2]) * 60 +
            parseInt(timestampMatch[3]) +
            parseInt(timestampMatch[4]) / 1000;
            
          const endTime = 
            parseInt(timestampMatch[5]) * 3600 +
            parseInt(timestampMatch[6]) * 60 +
            parseInt(timestampMatch[7]) +
            parseInt(timestampMatch[8]) / 1000;
          
          // Collect text lines until next timestamp or empty line
          const textLines: string[] = [];
          i++;
          
          while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
            textLines.push(lines[i].trim());
            i++;
          }
          
          const text = textLines.join(' ').trim();
          
          if (text) {
            entries.push({
              text,
              start: startTime,
              duration: endTime - startTime
            });
          }
        }
      }
      
      i++;
    }
  }
  
  return entries;
}

/**
 * Fetch available caption tracks for a YouTube video
 */
export async function getAvailableCaptions(
  videoId: string, 
  apiKey: string
): Promise<YouTubeCaptionTrack[]> {
  console.log(`🔍 Fetching available captions for video ${videoId} using YouTube Data API v3...`);
  
  const url = new URL('https://www.googleapis.com/youtube/v3/captions');
  url.searchParams.append('videoId', videoId);
  url.searchParams.append('part', 'snippet');
  url.searchParams.append('key', apiKey);
  
  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }
    
    const data: YouTubeCaptionList = await response.json();
    
    console.log(`✅ Found ${data.items.length} caption tracks`);
    
    // Sort captions by preference: non-auto-generated first, then by language
    const sorted = data.items.sort((a, b) => {
      // Prefer non-auto-generated
      if (a.snippet.isAutoSynced !== b.snippet.isAutoSynced) {
        return a.snippet.isAutoSynced ? 1 : -1;
      }
      // Then prefer specific languages (Polish, English)
      const langPriority: Record<string, number> = { 'pl': 0, 'en': 1, 'en-US': 2 };
      const aPriority = langPriority[a.snippet.language] ?? 999;
      const bPriority = langPriority[b.snippet.language] ?? 999;
      return aPriority - bPriority;
    });
    
    return sorted;
    
  } catch (error) {
    console.error('❌ Failed to fetch captions list:', error);
    throw error;
  }
}

/**
 * Download caption content for a specific track
 */
export async function downloadCaption(
  captionId: string,
  apiKey: string,
  format: 'srt' | 'vtt' | 'sbv' = 'srt'
): Promise<string> {
  console.log(`📥 Downloading caption ${captionId} in ${format} format...`);
  
  const url = new URL(`https://www.googleapis.com/youtube/v3/captions/${captionId}`);
  url.searchParams.append('tfmt', format);
  url.searchParams.append('key', apiKey);
  
  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'text/plain'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download caption: ${error}`);
    }
    
    const content = await response.text();
    console.log(`✅ Downloaded caption (${content.length} characters)`);
    
    return content;
    
  } catch (error) {
    console.error('❌ Failed to download caption:', error);
    throw error;
  }
}

/**
 * Get video metadata using YouTube Data API
 */
export async function getVideoMetadata(
  videoId: string,
  apiKey: string
): Promise<{
  title: string;
  description: string;
  duration: string;
  channel: string;
  publishedAt: string;
}> {
  console.log(`📊 Fetching video metadata for ${videoId}...`);
  
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.append('id', videoId);
  url.searchParams.append('part', 'snippet,contentDetails');
  url.searchParams.append('key', apiKey);
  
  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = data.items[0];
    
    return {
      title: video.snippet.title,
      description: video.snippet.description,
      duration: video.contentDetails.duration, // ISO 8601 duration
      channel: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch video metadata:', error);
    throw error;
  }
}

/**
 * Main function to fetch YouTube transcript using Data API v3
 */
interface VideoMetadata {
  title: string;
  description: string;
  duration: string;
  channel: string;
  publishedAt: string;
}

export async function fetchYouTubeTranscript(
  videoId: string,
  apiKey: string,
  preferredLanguage?: string
): Promise<{
  transcript: string;
  entries: TranscriptEntry[];
  language: string;
  isAutoGenerated: boolean;
  metadata?: VideoMetadata;
}> {
  console.log(`🎯 Fetching YouTube transcript using Data API v3...`);
  
  try {
    // Step 1: Get video metadata
    const metadata = await getVideoMetadata(videoId, apiKey);
    console.log(`📺 Video: "${metadata.title}" by ${metadata.channel}`);
    
    // Step 2: Get available captions
    const captions = await getAvailableCaptions(videoId, apiKey);
    
    if (captions.length === 0) {
      throw new Error('No captions available for this video');
    }
    
    // Step 3: Select best caption track
    let selectedCaption = captions[0];
    
    if (preferredLanguage) {
      // Try to find caption in preferred language
      const preferred = captions.find(c => 
        c.snippet.language === preferredLanguage ||
        c.snippet.language.startsWith(preferredLanguage)
      );
      
      if (preferred) {
        selectedCaption = preferred;
      }
    }
    
    console.log(`🎯 Selected caption: ${selectedCaption.snippet.name} (${selectedCaption.snippet.language})`);
    
    // Step 4: Download caption content
    const captionContent = await downloadCaption(selectedCaption.id, apiKey, 'srt');
    
    // Step 5: Parse caption format to structured entries
    const entries = parseCaptionFormat(captionContent, 'srt');
    
    // Step 6: Combine entries into full transcript
    const fullTranscript = entries.map(e => e.text).join(' ');
    
    console.log(`✅ Transcript ready: ${fullTranscript.length} characters, ${entries.length} segments`);
    
    return {
      transcript: fullTranscript,
      entries,
      language: selectedCaption.snippet.language,
      isAutoGenerated: selectedCaption.snippet.isAutoSynced || false,
      metadata
    };
    
  } catch (error) {
    console.error('❌ YouTube Data API transcript fetch failed:', error);
    throw error;
  }
}

/**
 * Simple transcript fetch (just the text)
 */
export async function getYouTubeTranscriptSimple(
  videoId: string,
  apiKey: string,
  language?: string
): Promise<string> {
  const result = await fetchYouTubeTranscript(videoId, apiKey, language);
  return result.transcript;
}