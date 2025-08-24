// YouTube audio extraction using yt-dlp
// Direct integration in Next.js without Python API

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface YtDlpAudioOptions {
  format?: 'mp3' | 'm4a' | 'best';
  quality?: 'best' | 'worst' | string;
  maxDuration?: number; // in seconds, default 60 minutes
}

export interface YtDlpAudioResult {
  audioBuffer: Buffer;
  title: string;
  duration: number;
  format: string;
  size: number;
}

/**
 * Extract audio from YouTube video using yt-dlp
 */
export async function extractAudioWithYtDlp(
  videoId: string,
  options: YtDlpAudioOptions = {}
): Promise<YtDlpAudioResult> {
  const { format = 'mp3', quality = 'best', maxDuration = 60 * 60 } = options;
  
  console.log(`🚀 Starting yt-dlp audio extraction for ${videoId}`);
  console.log(`🔧 Options: format=${format}, quality=${quality}, maxDuration=${maxDuration}s`);

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error('Invalid YouTube ID format');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const tempDir = tmpdir();
  const outputTemplate = join(tempDir, `ytdlp_${videoId}_%(title)s.%(ext)s`);

  // Prepare yt-dlp command with optimized settings
  const args = [
    videoUrl,
    '--extract-audio',
    '--audio-format', format,
    '--audio-quality', quality,
    '--output', outputTemplate,
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    // Anti-bot headers
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--add-header', 'Accept-Language:en-US,en;q=0.9',
    '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    // Additional options for reliability
    '--socket-timeout', '30',
    '--retries', '3',
    '--fragment-retries', '3'
  ];

  try {
    // Get video info first to check duration
    console.log('📊 Checking video information...');
    const videoInfo = await getVideoInfo(videoUrl);
    
    if (videoInfo.duration > maxDuration) {
      const minutes = Math.round(videoInfo.duration / 60);
      const maxMinutes = Math.round(maxDuration / 60);
      throw new Error(`Video too long (${minutes} minutes). Maximum allowed: ${maxMinutes} minutes.`);
    }

    console.log(`✅ Video info: "${videoInfo.title}" (${Math.round(videoInfo.duration / 60)} minutes)`);

    // Extract audio using yt-dlp
    console.log('🎵 Extracting audio with yt-dlp...');
    console.log(`🔧 Command: yt-dlp ${args.join(' ')}`);

    const audioFilePath = await runYtDlp(args);
    
    console.log(`📁 Audio file created: ${audioFilePath}`);

    // Read audio file to buffer
    console.log('📦 Reading audio file to buffer...');
    const audioBuffer = await fs.readFile(audioFilePath);
    
    // Get file stats
    const stats = await fs.stat(audioFilePath);
    
    // Clean up temp file
    try {
      await fs.unlink(audioFilePath);
      console.log('🗑️ Cleaned up temp audio file');
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
    }

    const result: YtDlpAudioResult = {
      audioBuffer,
      title: videoInfo.title,
      duration: videoInfo.duration,
      format: format,
      size: stats.size
    };

    console.log(`✅ Audio extraction completed: ${Math.round(result.size / 1024 / 1024)}MB`);
    
    return result;

  } catch (error) {
    console.error('❌ yt-dlp audio extraction failed:', error);
    
    // Enhanced error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('Video unavailable')) {
        throw new Error('Video is not available or may be private/restricted');
      }
      
      if (error.message.includes('Sign in to confirm') || error.message.includes('age')) {
        throw new Error('Video requires age verification or sign-in');
      }
      
      if (error.message.includes('copyright')) {
        throw new Error('Video may be copyright-restricted');
      }
      
      if (error.message.includes('too long')) {
        throw error; // Pass through duration error as-is
      }

      if (error.message.includes('not found') || error.message.includes('command')) {
        throw new Error('yt-dlp not found. Please install yt-dlp first.');
      }
    }
    
    throw new Error(`Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get video information without downloading
 */
async function getVideoInfo(videoUrl: string): Promise<{ title: string; duration: number }> {
  const args = [
    videoUrl,
    '--print', '%(title)s',
    '--print', '%(duration)s',
    '--no-warnings',
    '--quiet'
  ];

  try {
    const output = await runYtDlp(args);
    const lines = output.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('Failed to get video information');
    }

    const title = lines[0] || 'Unknown Title';
    const duration = parseInt(lines[1] || '0');

    if (isNaN(duration) || duration <= 0) {
      throw new Error('Invalid video duration');
    }

    return { title, duration };
    
  } catch (error) {
    console.error('❌ Failed to get video info:', error);
    throw new Error('Could not retrieve video information');
  }
}

/**
 * Run yt-dlp command and return output/file path
 */
function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Running: yt-dlp ${args.join(' ')}`);
    
    const ytdlp = spawn('yt-dlp', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    ytdlp.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        // For info commands, return stdout
        if (args.includes('--print')) {
          resolve(stdout);
          return;
        }

        // For download commands, find the created file
        const outputPattern = args[args.indexOf('--output') + 1];
        if (outputPattern) {
          // For simplicity, we'll scan the temp directory
          const tempDir = tmpdir();
          const videoIdMatch = args[0].match(/v=([^&]+)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : '';
          
          // Look for files matching our pattern using promises API
          fs.readdir(tempDir).then((files: string[]) => {
            const audioFile = files.find((file: string) => 
              file.includes(`ytdlp_${videoId}`) && 
              (file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.webm'))
            );

            if (audioFile) {
              resolve(join(tempDir, audioFile));
            } else {
              reject(new Error('Audio file not found after extraction'));
            }
          }).catch((err: Error) => {
            reject(new Error(`Failed to scan temp directory: ${err.message}`));
          });
        } else {
          resolve(stdout);
        }
      } else {
        console.error('❌ yt-dlp stderr:', stderr);
        reject(new Error(`yt-dlp failed with code ${code}: ${stderr || 'Unknown error'}`));
      }
    });

    ytdlp.on('error', (error) => {
      reject(new Error(`Failed to start yt-dlp: ${error.message}`));
    });

    // Set timeout for yt-dlp execution
    setTimeout(() => {
      ytdlp.kill();
      reject(new Error('yt-dlp command timed out'));
    }, 5 * 60 * 1000); // 5 minutes timeout
  });
}

/**
 * Check if yt-dlp is installed and accessible
 */
export async function checkYtDlpAvailability(): Promise<boolean> {
  try {
    await runYtDlp(['--version']);
    return true;
  } catch (error) {
    console.error('❌ yt-dlp not available:', error);
    return false;
  }
}