/**
 * Experimental YouTube transcript extraction using yt-dlp
 * This is a cost-effective alternative to Gladia API for getting YouTube captions
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface YtDlpTranscriptResult {
  transcript: string;
  language: string;
  method: 'auto-generated' | 'manual';
  success: boolean;
  error?: string;
}

/**
 * Extract transcript using yt-dlp subprocess
 * This method attempts to download captions without the video file
 */
export async function fetchYouTubeTranscriptYtDlp(
  videoId: string,
  preferredLanguage = 'en'
): Promise<YtDlpTranscriptResult> {
  const startTime = Date.now();
  console.log(`🔬 [EXPERIMENTAL] Starting yt-dlp transcript extraction for: ${videoId}`);
  
  // Check if yt-dlp is available
  if (!await isYtDlpAvailable()) {
    throw new Error('yt-dlp is not available. Install with: pip install yt-dlp');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlp-captions-'));
  
  try {
    console.log(`🔬 [EXPERIMENTAL] Using temp directory: ${tempDir}`);
    
    // Try to download captions using yt-dlp
    const result = await downloadCaptionsWithYtDlp(videoUrl, tempDir, preferredLanguage);
    
    const duration = Date.now() - startTime;
    console.log(`🔬 [EXPERIMENTAL] yt-dlp extraction completed in ${duration}ms`);
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`🔬 [EXPERIMENTAL] yt-dlp extraction failed after ${duration}ms:`, error);
    
    return {
      transcript: '',
      language: preferredLanguage,
      method: 'auto-generated',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown yt-dlp error'
    };
  } finally {
    // Cleanup temp directory (unless debug mode is enabled)
    if (!isYtDlpDebugEnabled()) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`🔬 [EXPERIMENTAL] Cleaned up temp directory: ${tempDir}`);
      } catch (cleanupError) {
        console.warn(`🔬 [EXPERIMENTAL] Failed to cleanup temp directory:`, cleanupError);
      }
    } else {
      console.log(`🔬 [DEBUG] Preserving temp directory for analysis: ${tempDir}`);
      console.log(`🔬 [DEBUG] You can manually inspect files at: ${tempDir}`);
    }
  }
}

/**
 * Check if yt-dlp is available in system PATH
 */
async function isYtDlpAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('yt-dlp', ['--version'], { stdio: 'ignore' });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Download captions using yt-dlp subprocess
 */
async function downloadCaptionsWithYtDlp(
  videoUrl: string,
  tempDir: string,
  preferredLanguage: string
): Promise<YtDlpTranscriptResult> {
  
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(tempDir, '%(id)s.%(ext)s');
    
    // yt-dlp arguments for caption extraction
    const args = [
      videoUrl,
      '--write-subs',           // Write subtitle files
      '--write-auto-subs',      // Write automatic captions
      '--sub-langs', `${preferredLanguage},en`, // Preferred languages
      '--sub-format', 'json3',  // JSON3 format (structured)
      '--skip-download',        // Don't download video
      '--no-warnings',          // Reduce noise
      '-o', outputPattern       // Output pattern
    ];
    
    console.log(`🔬 [EXPERIMENTAL] Running yt-dlp with args:`, args.slice(0, -2)); // Don't log paths
    
    const child = spawn('yt-dlp', args, {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set timeout for yt-dlp process
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('yt-dlp process timed out after 30 seconds'));
    }, 30000);
    
    child.on('close', async (code) => {
      clearTimeout(timeout);
      
      try {
        console.log(`🔬 [EXPERIMENTAL] yt-dlp process completed with code: ${code}`);
        
        if (code !== 0) {
          console.error(`🔬 [EXPERIMENTAL] yt-dlp stderr:`, stderr);
          throw new Error(`yt-dlp failed with code ${code}: ${stderr}`);
        }
        
        // Find and parse caption files
        const result = await parseCaptionFiles(tempDir, preferredLanguage);
        resolve(result);
        
      } catch (error) {
        reject(error);
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
    });
  });
}

/**
 * Parse downloaded caption files and extract transcript text
 */
async function parseCaptionFiles(
  tempDir: string, 
  preferredLanguage: string
): Promise<YtDlpTranscriptResult> {
  
  try {
    const files = await fs.readdir(tempDir);
    console.log(`🔬 [EXPERIMENTAL] Found files in temp dir:`, files);
    
    // Look for caption files (prioritize preferred language)
    const captionFiles = files.filter(file => 
      file.includes('.json3') || file.includes('.vtt') || file.includes('.srt')
    );
    
    if (captionFiles.length === 0) {
      throw new Error('No caption files found after yt-dlp extraction');
    }
    
    console.log(`🔬 [EXPERIMENTAL] Found caption files:`, captionFiles);
    
    // Prioritize files by language and format
    const prioritizedFile = prioritizeCaptionFile(captionFiles, preferredLanguage);
    const filePath = path.join(tempDir, prioritizedFile);
    
    console.log(`🔬 [EXPERIMENTAL] Using caption file: ${prioritizedFile}`);
    
    // Read and parse the caption file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Debug logging for content analysis
    console.log(`🔬 [DEBUG] Caption file size: ${fileContent.length} characters`);
    if (isYtDlpDebugEnabled()) {
      console.log(`🔬 [DEBUG] Raw file content preview (first 500 chars):`);
      console.log(fileContent.substring(0, 500));
      console.log(`🔬 [DEBUG] Raw file content preview (last 500 chars):`);
      console.log(fileContent.substring(Math.max(0, fileContent.length - 500)));
    }
    
    const transcript = await parseCaptionContent(fileContent, prioritizedFile);
    
    if (!transcript.trim()) {
      throw new Error('Extracted transcript is empty');
    }
    
    console.log(`🔬 [EXPERIMENTAL] Extracted transcript: ${transcript.length} characters`);
    
    return {
      transcript: transcript.trim(),
      language: detectLanguageFromFilename(prioritizedFile) || preferredLanguage,
      method: prioritizedFile.includes('auto') ? 'auto-generated' : 'manual',
      success: true
    };
    
  } catch (error) {
    console.error(`🔬 [EXPERIMENTAL] Failed to parse caption files:`, error);
    throw error;
  }
}

/**
 * Prioritize caption files by language preference and format
 */
function prioritizeCaptionFile(files: string[], preferredLanguage: string): string {
  // Priority order: preferred language + json3 > preferred language + other > english + json3 > any
  
  const preferredJson3 = files.find(f => f.includes(preferredLanguage) && f.includes('json3'));
  if (preferredJson3) return preferredJson3;
  
  const preferredAny = files.find(f => f.includes(preferredLanguage));
  if (preferredAny) return preferredAny;
  
  const englishJson3 = files.find(f => f.includes('en') && f.includes('json3'));
  if (englishJson3) return englishJson3;
  
  const englishAny = files.find(f => f.includes('en'));
  if (englishAny) return englishAny;
  
  // Fallback to first available file
  return files[0];
}

/**
 * Parse different caption file formats
 */
async function parseCaptionContent(content: string, filename: string): Promise<string> {
  try {
    if (filename.includes('.json3')) {
      return parseJson3Captions(content);
    } else if (filename.includes('.vtt')) {
      return parseVttCaptions(content);
    } else if (filename.includes('.srt')) {
      return parseSrtCaptions(content);
    } else {
      // Try to detect format from content
      if (content.trim().startsWith('{')) {
        return parseJson3Captions(content);
      } else if (content.includes('WEBVTT')) {
        return parseVttCaptions(content);
      } else {
        return parseSrtCaptions(content);
      }
    }
  } catch (error) {
    console.error(`🔬 [EXPERIMENTAL] Failed to parse caption content:`, error);
    throw new Error(`Failed to parse caption format: ${error}`);
  }
}

/**
 * Parse JSON3 caption format (YouTube's structured format)
 */
function parseJson3Captions(content: string): string {
  try {
    console.log(`🔬 [DEBUG] Attempting to parse JSON3 content...`);
    const data = JSON.parse(content);
    
    // Debug: Log the structure we received
    console.log(`🔬 [DEBUG] JSON3 structure analysis:`);
    console.log(`🔬 [DEBUG] - Has 'events' property:`, !!data.events);
    console.log(`🔬 [DEBUG] - Events is array:`, Array.isArray(data.events));
    if (data.events) {
      console.log(`🔬 [DEBUG] - Events length:`, data.events.length);
      console.log(`🔬 [DEBUG] - First event structure:`, Object.keys(data.events[0] || {}));
    }
    console.log(`🔬 [DEBUG] - All top-level keys:`, Object.keys(data));
    
    if (isYtDlpDebugEnabled() && data.events && data.events[0]) {
      console.log(`🔬 [DEBUG] First event sample:`, JSON.stringify(data.events[0], null, 2));
      
      // Check middle events to see real text structure
      const eventsLength = data.events.length;
      const middleStart = Math.floor(eventsLength * 0.3); // 30% through
      const middleEnd = Math.floor(eventsLength * 0.7);   // 70% through
      
      console.log(`🔬 [DEBUG] Sampling middle events ${middleStart}-${middleEnd}:`);
      for (let i = middleStart; i < Math.min(middleEnd, middleStart + 10); i++) {
        const event = data.events[i];
        if (event) {
          console.log(`🔬 [DEBUG] Event ${i}:`, JSON.stringify(event, null, 2));
          if (event.segs) {
            console.log(`🔬 [DEBUG] Event ${i} segs content:`, event.segs.map((s: any) => s.utf8).join(''));
          }
        }
      }
    }
    
    if (data.events && Array.isArray(data.events)) {
      // Enhanced parsing strategy: collect all text segments
      const textSegments = [];
      let eventsWithSegs = 0;
      let eventsWithText = 0;
      
      for (const event of data.events) {
        if (event.segs && Array.isArray(event.segs)) {
          eventsWithSegs++;
          
          for (const seg of event.segs) {
            if (seg.utf8 && typeof seg.utf8 === 'string') {
              const text = seg.utf8.trim();
              // Skip empty strings and standalone newlines
              if (text && text !== '\n' && text !== '\r\n') {
                textSegments.push(text);
                eventsWithText++;
              }
            }
          }
        }
      }
      
      console.log(`🔬 [DEBUG] Events with segs: ${eventsWithSegs}`);
      console.log(`🔬 [DEBUG] Events with actual text: ${eventsWithText}`);
      console.log(`🔬 [DEBUG] Total text segments: ${textSegments.length}`);
      
      if (textSegments.length > 0) {
        console.log(`🔬 [DEBUG] First few text segments:`, textSegments.slice(0, 5));
        console.log(`🔬 [DEBUG] Last few text segments:`, textSegments.slice(-5));
      }
      
      const transcript = textSegments.join(' ')
        .replace(/\s+/g, ' ') // Clean up multiple spaces
        .trim();
        
      console.log(`🔬 [DEBUG] Extracted transcript length: ${transcript.length} chars`);
      return transcript;
    }
    
    throw new Error(`Invalid JSON3 caption structure - no events array found`);
  } catch (error) {
    console.error(`🔬 [DEBUG] JSON3 parsing failed:`, error);
    throw new Error(`Failed to parse JSON3 captions: ${error}`);
  }
}

/**
 * Parse WebVTT caption format
 */
function parseVttCaptions(content: string): string {
  return content
    .split('\n')
    .filter(line => 
      !line.includes('WEBVTT') && 
      !line.includes('-->') &&
      !line.match(/^\d+$/) &&
      line.trim().length > 0
    )
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Parse SRT caption format  
 */
function parseSrtCaptions(content: string): string {
  return content
    .split('\n')
    .filter(line => 
      !line.match(/^\d+$/) &&
      !line.includes('-->') &&
      line.trim().length > 0
    )
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Detect language from filename
 */
function detectLanguageFromFilename(filename: string): string | null {
  const langMatch = filename.match(/\.([a-z]{2})(-[A-Z]{2})?\./) || filename.match(/\.([a-z]{2})\./);
  return langMatch ? langMatch[1] : null;
}

/**
 * Check if experimental yt-dlp method is enabled
 */
export function isYtDlpExperimentEnabled(): boolean {
  return process.env.ENABLE_YTDLP_EXPERIMENTAL === 'true';
}

/**
 * Check if debug mode is enabled (preserves temp files)
 */
export function isYtDlpDebugEnabled(): boolean {
  return process.env.YTDLP_DEBUG_MODE === 'true';
}