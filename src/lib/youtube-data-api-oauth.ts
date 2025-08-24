/**
 * YouTube Data API v3 Client with OAuth2 Authentication
 * Full access to captions download with proper authorization
 */

import { getValidAccessToken } from './youtube-oauth';

interface YouTubeCaptionTrack {
  id: string;
  snippet: {
    videoId: string;
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

interface YouTubeThumbnails {
  default?: { url: string; width: number; height: number };
  medium?: { url: string; width: number; height: number };
  high?: { url: string; width: number; height: number };
  standard?: { url: string; width: number; height: number };
  maxres?: { url: string; width: number; height: number };
}

interface VideoMetadata {
  title: string;
  description: string;
  duration: string;
  channel: string;
  publishedAt: string;
  thumbnails: YouTubeThumbnails;
}

/**
 * Parse caption format to structured transcript entries
 */
function parseCaptionFormat(content: string, format: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  
  try {
    if (format === 'srt') {
      // Parse SRT format
      const blocks = content.trim().split(/\n\s*\n/);
      
      for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;
        
        // Parse timestamp line (00:00:01,000 --> 00:00:04,000)
        const timestampLine = lines[1];
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
          
          // Get text (lines 2+)
          const text = lines.slice(2).join(' ').trim();
          
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
            
            // Collect text lines
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
  } catch (error) {
    console.error('❌ Caption parsing error:', error);
    // Fall back to simple text extraction
    return [{
      text: content,
      start: 0,
      duration: 0
    }];
  }
  
  return entries;
}

/**
 * Fetch available caption tracks with OAuth2
 */
export async function getAvailableCaptionsOAuth(
  videoId: string, 
  userId: string
): Promise<YouTubeCaptionTrack[]> {
  console.log(`🔍 Fetching available captions for ${videoId} with OAuth2...`);
  
  try {
    const accessToken = await getValidAccessToken(userId);
    
    const url = new URL('https://www.googleapis.com/youtube/v3/captions');
    url.searchParams.append('videoId', videoId);
    url.searchParams.append('part', 'snippet');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
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
      const langPriority: Record<string, number> = { 
        'pl': 0, 'pl-PL': 0,
        'en': 1, 'en-US': 2, 'en-GB': 3 
      };
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
 * Download caption content with OAuth2 (FULL ACCESS)
 */
export async function downloadCaptionOAuth(
  captionId: string,
  userId: string,
  format: 'srt' | 'vtt' | 'sbv' = 'srt'
): Promise<string> {
  console.log(`📥 Downloading caption ${captionId} in ${format} format with OAuth2...`);
  
  try {
    const accessToken = await getValidAccessToken(userId);
    
    const url = new URL(`https://www.googleapis.com/youtube/v3/captions/${captionId}`);
    url.searchParams.append('tfmt', format);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'text/plain',
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Caption download failed: ${response.status} - ${error}`);
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
 * Get video metadata with OAuth2
 */
export async function getVideoMetadataOAuth(
  videoId: string,
  userId: string
): Promise<VideoMetadata> {
  console.log(`📊 Fetching video metadata for ${videoId} with OAuth2...`);
  
  try {
    const accessToken = await getValidAccessToken(userId);
    
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.append('id', videoId);
    url.searchParams.append('part', 'snippet,contentDetails');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`YouTube API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found or not accessible');
    }
    
    const video = data.items[0];
    
    return {
      title: video.snippet.title,
      description: video.snippet.description,
      duration: video.contentDetails.duration, // ISO 8601 duration
      channel: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      thumbnails: video.snippet.thumbnails
    };
    
  } catch (error) {
    console.error('❌ Failed to fetch video metadata:', error);
    throw error;
  }
}

/**
 * Main function to fetch YouTube transcript using OAuth2
 */
export async function fetchYouTubeTranscriptOAuth(
  videoId: string,
  userId: string,
  preferredLanguage?: string
): Promise<{
  transcript: string;
  entries: TranscriptEntry[];
  language: string;
  isAutoGenerated: boolean;
  metadata: VideoMetadata;
  source: string;
}> {
  console.log(`🎯 Fetching YouTube transcript using OAuth2 for user ${userId}...`);
  
  try {
    // Step 1: Get video metadata
    const metadata = await getVideoMetadataOAuth(videoId, userId);
    console.log(`📺 Video: "${metadata.title}" by ${metadata.channel}`);
    
    // Step 2: Get available captions
    const captions = await getAvailableCaptionsOAuth(videoId, userId);
    
    if (captions.length === 0) {
      throw new Error('No captions available for this video');
    }
    
    // Step 3: Select best caption track
    let selectedCaption = captions[0];
    
    if (preferredLanguage) {
      // Try to find caption in preferred language
      const preferred = captions.find(c => 
        c.snippet.language === preferredLanguage ||
        c.snippet.language.startsWith(preferredLanguage) ||
        c.snippet.language.toLowerCase().includes(preferredLanguage.toLowerCase())
      );
      
      if (preferred) {
        selectedCaption = preferred;
      }
    }
    
    console.log(`🎯 Selected caption: "${selectedCaption.snippet.name}" (${selectedCaption.snippet.language})`);
    console.log(`   Auto-generated: ${selectedCaption.snippet.isAutoSynced || false}`);
    
    // Step 4: Download caption content
    const captionContent = await downloadCaptionOAuth(selectedCaption.id, userId, 'srt');
    
    // Step 5: Parse caption format to structured entries
    const entries = parseCaptionFormat(captionContent, 'srt');
    
    // Step 6: Combine entries into full transcript
    const fullTranscript = entries.map(e => e.text).join(' ').trim();
    
    if (!fullTranscript || fullTranscript.length === 0) {
      throw new Error('Caption content is empty');
    }
    
    console.log(`✅ OAuth2 transcript ready: ${fullTranscript.length} characters, ${entries.length} segments`);
    
    return {
      transcript: fullTranscript,
      entries,
      language: selectedCaption.snippet.language,
      isAutoGenerated: selectedCaption.snippet.isAutoSynced || false,
      metadata,
      source: `youtube-oauth2-${selectedCaption.snippet.language}${selectedCaption.snippet.isAutoSynced ? '-auto' : ''}`
    };
    
  } catch (error) {
    console.error('❌ YouTube OAuth2 transcript fetch failed:', error);
    throw error;
  }
}

/**
 * Simple transcript fetch with OAuth2 (just the text)
 */
export async function getYouTubeTranscriptOAuth(
  videoId: string,
  userId: string,
  language?: string
): Promise<string> {
  const result = await fetchYouTubeTranscriptOAuth(videoId, userId, language);
  return result.transcript;
}

/**
 * Check if transcript is available for video (without downloading)
 */
export async function checkTranscriptAvailabilityOAuth(
  videoId: string,
  userId: string
): Promise<{
  available: boolean;
  captionCount: number;
  languages: string[];
  hasManualCaptions: boolean;
  hasAutoCaptions: boolean;
}> {
  try {
    const captions = await getAvailableCaptionsOAuth(videoId, userId);
    
    const languages = captions.map(c => c.snippet.language);
    const hasManualCaptions = captions.some(c => !c.snippet.isAutoSynced);
    const hasAutoCaptions = captions.some(c => c.snippet.isAutoSynced);
    
    return {
      available: captions.length > 0,
      captionCount: captions.length,
      languages,
      hasManualCaptions,
      hasAutoCaptions
    };
  } catch (error) {
    console.error('❌ Failed to check transcript availability:', error);
    return {
      available: false,
      captionCount: 0,
      languages: [],
      hasManualCaptions: false,
      hasAutoCaptions: false
    };
  }
}