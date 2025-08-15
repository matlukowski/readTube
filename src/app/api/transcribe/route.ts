import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { getAIService } from '@/lib/ai';

// Types for yt-dlp response
interface YtDlpVideoInfo {
  title?: string;
  subtitles?: Record<string, Array<{ ext: string; url: string }>>;
  automatic_captions?: Record<string, Array<{ ext: string; url: string }>>;
}

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (i === retries - 1) break;
      
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`🔄 Retry ${i + 1}/${retries} after ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Function to extract subtitles using yt-dlp via direct CLI
async function extractSubtitlesWithYtDlp(youtubeId: string): Promise<string | null> {
  try {
    console.log(`🔍 Trying yt-dlp subtitle extraction for ${youtubeId}...`);
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    // Use direct CLI command to avoid path issues
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // First, try to download subtitles directly
    const tempDir = require('path').join(process.cwd(), 'temp');
    if (!require('fs').existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir, { recursive: true });
    }
    
    const command = `yt-dlp --write-auto-subs --sub-langs en --skip-download --sub-format vtt -o "${tempDir}\\%(title)s.%(ext)s" "${videoUrl}"`;
    console.log(`🛠️ Running subtitle extraction: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    console.log(`📤 yt-dlp stdout:`, stdout);
    if (stderr) console.log(`📤 yt-dlp stderr:`, stderr);
    
    // Find the downloaded subtitle file
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(tempDir).filter((f: string) => f.endsWith('.en.vtt'));
    
    if (files.length === 0) {
      console.log(`❌ No subtitle file found`);
      return null;
    }
    
    const subtitleFile = path.join(tempDir, files[0]);
    const subtitleContent = fs.readFileSync(subtitleFile, 'utf8');
    
    console.log(`📄 Subtitle file found: ${subtitleFile}`);
    console.log(`📄 Subtitle content length: ${subtitleContent.length}`);
    
    // Parse WebVTT format
    const lines = subtitleContent.split('\n');
    const subtitleText = lines
      .filter(line => 
        !line.includes('-->') && 
        !line.startsWith('WEBVTT') && 
        !line.startsWith('NOTE') && 
        !line.startsWith('Kind:') &&
        !line.startsWith('Language:') &&
        line.trim()
      )
      .join(' ')
      .replace(/<[^>]*>/g, '') // Remove HTML tags and timing markers
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .replace(/\s+/g, ' ');
    
    // Cleanup temp file
    try {
      fs.unlinkSync(subtitleFile);
      console.log(`🧹 Cleaned up temp file: ${subtitleFile}`);
    } catch (cleanupError) {
      console.log(`⚠️ Failed to cleanup temp file:`, cleanupError);
    }
    
    console.log(`✅ yt-dlp subtitle extraction successful. Length: ${subtitleText.length}`);
    console.log(`📝 Preview: ${subtitleText.substring(0, 200)}...`);
    
    return subtitleText;
    
  } catch (error) {
    console.error(`❌ yt-dlp subtitle extraction failed:`, error);
    return null;
  }
}

// Function to extract subtitles using direct YouTube API approach
async function extractSubtitlesDirectAPI(youtubeId: string): Promise<string | null> {
  try {
    console.log(`🔍 Trying direct YouTube API approach for ${youtubeId}...`);
    
    // Try to get video page HTML and extract player config
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const response = await retryWithBackoff(() => fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      }
    }));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract player configuration from HTML
    const playerConfigMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerConfigMatch) {
      throw new Error('Could not find player configuration');
    }
    
    const playerConfig = JSON.parse(playerConfigMatch[1]);
    const captions = playerConfig?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captions || captions.length === 0) {
      console.log(`❌ No captions found in player config`);
      return null;
    }
    
    console.log(`📝 Found ${captions.length} caption tracks via direct API`);
    
    // Select the best caption track
    let selectedCaption = captions.find((c: any) => c.kind === 'asr' && c.languageCode?.startsWith('en')) ||
                         captions.find((c: any) => c.languageCode?.startsWith('en')) ||
                         captions[0];
    
    if (!selectedCaption) {
      console.log(`❌ No suitable caption track found`);
      return null;
    }
    
    console.log(`✅ Selected caption: ${selectedCaption.name?.simpleText} (${selectedCaption.languageCode})`);
    
    // Fetch subtitle content with retry
    const subtitleResponse = await retryWithBackoff(() => fetch(selectedCaption.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://www.youtube.com/watch?v=${youtubeId}`
      }
    }));
    if (!subtitleResponse.ok) {
      throw new Error(`Failed to fetch subtitles: ${subtitleResponse.status}`);
    }
    
    const xmlContent = await subtitleResponse.text();
    
    // Parse XML to extract text
    const textMatches = xmlContent.match(/<text[^>]*>(.*?)<\/text>/g);
    if (!textMatches) {
      console.log(`❌ No text content found in subtitle XML`);
      return null;
    }
    
    const subtitleText = textMatches
      .map(match => match.replace(/<[^>]*>/g, ''))
      .join(' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .replace(/\s+/g, ' ');
    
    console.log(`✅ Direct API subtitle extraction successful. Length: ${subtitleText.length}`);
    console.log(`📝 Preview: ${subtitleText.substring(0, 200)}...`);
    
    return subtitleText;
    
  } catch (error) {
    console.error(`❌ Direct API subtitle extraction failed:`, error);
    return null;
  }
}

// Function to extract subtitles using ytdl-core
async function extractSubtitlesWithYtdl(youtubeId: string): Promise<string | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    console.log(`🔍 Getting video info for ${youtubeId} with ytdl-core...`);
    
    const info = await ytdl.getInfo(videoUrl);
    console.log(`📊 Video info obtained. Title: ${info.videoDetails.title}`);
    
    // Get player_response with subtitle info
    const playerResponse = info.player_response;
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captions || captions.length === 0) {
      console.log(`❌ No captions found in video info`);
      return null;
    }
    
    console.log(`📝 Found ${captions.length} caption tracks:`);
    captions.forEach((caption: any, index: number) => {
      console.log(`  ${index}: ${caption.name?.simpleText} (${caption.languageCode}) - kind: ${caption.kind || 'manual'}`);
    });
    
    // Prioritize auto-generated subtitles, then manual ones
    let selectedCaption = captions.find((c: any) => c.kind === 'asr') || // Auto-generated
                         captions.find((c: any) => c.languageCode?.startsWith('en')) || // English
                         captions[0]; // First available
    
    if (!selectedCaption) {
      console.log(`❌ No suitable caption track found`);
      return null;
    }
    
    console.log(`✅ Selected caption: ${selectedCaption.name?.simpleText} (${selectedCaption.languageCode}) - kind: ${selectedCaption.kind || 'manual'}`);
    
    // Fetch the subtitle content
    const subtitleUrl = selectedCaption.baseUrl;
    console.log(`🔗 Fetching subtitles from: ${subtitleUrl}`);
    
    const response = await retryWithBackoff(() => fetch(subtitleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://www.youtube.com/watch?v=${youtubeId}`
      }
    }));
    if (!response.ok) {
      throw new Error(`Failed to fetch subtitles: ${response.status}`);
    }
    
    const xmlContent = await response.text();
    console.log(`📄 Subtitle XML length: ${xmlContent.length}`);
    
    // Parse XML to extract text content
    const textMatches = xmlContent.match(/<text[^>]*>(.*?)<\/text>/g);
    if (!textMatches) {
      console.log(`❌ No text content found in subtitle XML`);
      return null;
    }
    
    // Extract and clean text
    const subtitleText = textMatches
      .map(match => {
        // Remove XML tags and decode HTML entities
        const text = match.replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        return text.trim();
      })
      .filter(text => text.length > 0)
      .join(' ');
    
    console.log(`✅ Extracted subtitle text length: ${subtitleText.length}`);
    console.log(`📝 Preview: ${subtitleText.substring(0, 200)}...`);
    
    return subtitleText;
    
  } catch (error) {
    console.error(`❌ ytdl-core subtitle extraction failed:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { youtubeId, language } = transcribeRequestSchema.parse(body);

    // Check if transcript already exists in database
    const existingVideo = await prisma.video.findUnique({
      where: { youtubeId },
      select: { transcript: true },
    });

    if (existingVideo?.transcript) {
      console.log('🔙 Backend returning cached transcript. Length:', existingVideo.transcript?.length || 'NO TRANSCRIPT');
      return NextResponse.json({ 
        transcript: existingVideo.transcript,
        cached: true 
      });
    }

    let fullTranscript: string;
    let transcriptionMethod: 'youtube' | 'whisper';

    try {
      // Method 1: Try yt-dlp (most reliable in 2024/2025)
      console.log(`🔍 Trying yt-dlp subtitle extraction for ${youtubeId}...`);
      const ytDlpResult = await extractSubtitlesWithYtDlp(youtubeId);
      
      if (ytDlpResult && ytDlpResult.length > 0) {
        fullTranscript = ytDlpResult;
        transcriptionMethod = 'youtube';
        console.log(`✅ yt-dlp subtitle extraction successful`);
      } else {
        console.log(`⚠️ yt-dlp failed, trying direct API approach...`);
        
        // Method 2: Try direct YouTube API approach
        const directAPIResult = await extractSubtitlesDirectAPI(youtubeId);
        
        if (directAPIResult && directAPIResult.length > 0) {
          fullTranscript = directAPIResult;
          transcriptionMethod = 'youtube';
          console.log(`✅ Direct API subtitle extraction successful`);
        } else {
          console.log(`⚠️ Direct API failed, trying ytdl-core...`);
          
          // Method 3: Try ytdl-core as fallback
          const ytdlResult = await extractSubtitlesWithYtdl(youtubeId);
          
          if (ytdlResult && ytdlResult.length > 0) {
            fullTranscript = ytdlResult;
            transcriptionMethod = 'youtube';
            console.log(`✅ ytdl-core subtitle extraction successful`);
          } else {
            console.log(`⚠️ ytdl-core failed, trying youtube-transcript library...`);
            
            // Method 4: Fallback to youtube-transcript library
            let transcriptData;
            const languagesToTry = [
              // Auto-detect first
              'auto',
              // English variants
              'en', 'en-US', 'en-GB', 'en-CA', 'en-AU',
              // Polish variants  
              'pl', 'pl-PL',
              // User specified language
              language || 'en',
              // Common languages
              'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'hi'
            ];
            
            // Remove duplicates
            const uniqueLanguages = [...new Set(languagesToTry)];
            
            for (const lang of uniqueLanguages) {
              try {
                console.log(`🔍 Trying language: ${lang}`);
                
                if (lang === 'auto') {
                  // Try without language specification (auto-detect)
                  transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId);
                } else {
                  // Try with specific language
                  transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId, { 
                    lang
                  });
                }
                
                // Check if we actually got content
                if (transcriptData && transcriptData.length > 0) {
                  console.log(`✅ Successfully fetched subtitles with language: ${lang}`);
                  console.log(`📊 Found ${transcriptData.length} subtitle segments`);
                  break;
                } else {
                  console.log(`⚠️ Language ${lang} returned empty transcript, continuing...`);
                  transcriptData = null;
                }
              } catch (langError) {
                const errorMessage = langError instanceof Error ? langError.message : 'Unknown error';
                console.log(`❌ Failed with language ${lang}:`, errorMessage);
                continue;
              }
            }
            
            if (!transcriptData) {
              throw new Error('No subtitles available in any language');
            }

            console.log(`🔍 Raw transcript data structure:`, {
              isArray: Array.isArray(transcriptData),
              length: transcriptData?.length || 0,
              type: typeof transcriptData
            });
            
            if (transcriptData && transcriptData.length > 0) {
              console.log(`📊 Transcript segments count:`, transcriptData.length);
              console.log(`🔍 First segment structure:`, {
                text: transcriptData[0]?.text?.substring(0, 50) + '...',
                offset: transcriptData[0]?.offset,
                duration: transcriptData[0]?.duration,
                keys: Object.keys(transcriptData[0] || {})
              });
              console.log(`🔍 Last segment:`, transcriptData[transcriptData.length - 1]);
            } else {
              console.log(`⚠️ Empty or invalid transcript data received`);
            }

            fullTranscript = transcriptData
              .map((segment, index) => {
                if (index < 3) { // Only log first 3 segments to avoid spam
                  console.log(`🔍 Processing segment ${index}:`, {
                    text: segment.text?.substring(0, 30) + '...',
                    offset: segment.offset,
                    hasText: !!segment.text
                  });
                }
                return segment.text || '';
              })
              .filter(text => text.trim().length > 0) // Remove empty segments
              .join(' ');

            transcriptionMethod = 'youtube';
            console.log(`✅ YouTube transcript library fallback successful`);
          }
        }
      }
      
      console.log(`🔍 Final transcript length:`, fullTranscript?.length || 0);
      console.log(`🔍 Final transcript preview:`, fullTranscript?.substring(0, 200) || 'EMPTY');
    } catch (youtubeError) {
      console.log(`⚠️ YouTube subtitles failed for ${youtubeId}, trying Whisper...`);
      
      try {
        // Fallback to Whisper API (paid but reliable)
        const ai = getAIService();
        fullTranscript = await ai.transcribeYouTubeVideo(youtubeId);
        transcriptionMethod = 'whisper';
        console.log(`✅ Whisper transcript generated for ${youtubeId}`);
      } catch (whisperError) {
        console.error('Both transcription methods failed:', { youtubeError, whisperError });
        throw new Error('Transcript not available and audio transcription failed');
      }
    }

    // Save or update video with transcript
    await prisma.video.upsert({
      where: { youtubeId },
      update: { transcript: fullTranscript },
      create: {
        youtubeId,
        title: 'Pending', // Will be updated when video details are fetched
        channelName: 'Pending',
        thumbnail: '',
        transcript: fullTranscript,
      },
    });

    console.log('🔙 Backend returning transcript. Length:', fullTranscript?.length || 'NO TRANSCRIPT');
    console.log('🔙 Backend transcript preview:', fullTranscript?.substring(0, 100) || 'EMPTY');
    
    const responseData = { 
      transcript: fullTranscript,
      cached: false,
      method: transcriptionMethod
    };
    
    console.log('🔙 Backend response data:', JSON.stringify(responseData, null, 2));
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Transcribe API error:', error);
    
    // Handle specific youtube-transcript errors
    if (error instanceof Error) {
      console.log('🔍 Error details:', {
        message: error.message,
        stack: error.stack?.substring(0, 200),
        name: error.name
      });
      
      if (error.message.includes('Could not find') || error.message.includes('No subtitles')) {
        return NextResponse.json(
          { error: 'No subtitles found for this video. The video may not have auto-generated or manual subtitles available.' },
          { status: 404 }
        );
      }
      if (error.message.includes('Disabled') || error.message.includes('disabled')) {
        return NextResponse.json(
          { error: 'Subtitles are disabled for this video by the creator.' },
          { status: 403 }
        );
      }
      if (error.message.includes('private') || error.message.includes('Private')) {
        return NextResponse.json(
          { error: 'Cannot access subtitles for private videos.' },
          { status: 403 }
        );
      }
      if (error.message.includes('not available') || error.message.includes('unavailable')) {
        return NextResponse.json(
          { error: 'Video or subtitles temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}