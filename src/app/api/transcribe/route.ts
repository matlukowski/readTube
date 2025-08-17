import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

// Types for yt-dlp response (currently unused but kept for future use)
// interface YtDlpVideoInfo {
//   title?: string;
//   subtitles?: Record<string, Array<{ ext: string; url: string }>>;
//   automatic_captions?: Record<string, Array<{ ext: string; url: string }>>;
// }

// Function to remove duplicated text segments from subtitle content
function removeDuplicatedSubtitleText(text: string): string {
  if (!text || text.length === 0) return text;
  
  // Split into sentences and clean them
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Remove exact duplicates while preserving order
  const uniqueSentences = [];
  const seenSentences = new Set();
  
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seenSentences.has(normalized) && normalized.length > 0) {
      seenSentences.add(normalized);
      uniqueSentences.push(sentence);
    }
  }
  
  return uniqueSentences.join('. ').trim();
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
async function extractSubtitlesWithYtDlp(youtubeId: string, language: string = 'pl'): Promise<string | null> {
  return retryWithBackoff(async () => {
    console.log(`🔍 Trying yt-dlp subtitle extraction for ${youtubeId} with language preference: ${language}...`);
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    // Use direct CLI command to avoid path issues
    const execAsync = promisify(exec);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Define language priority: Polish first, then English, then auto
    const languagesToTry = language === 'pl' 
      ? ['pl', 'en', 'en-US', 'en-GB'] 
      : ['en', 'en-US', 'en-GB', 'pl'];
    
    let subtitleText = null;
    const downloadedFiles: string[] = [];
    
    // Try each language in priority order
    for (const langCode of languagesToTry) {
      try {
        console.log(`  🌐 Trying language: ${langCode}`);
        
        const command = `yt-dlp --write-auto-subs --sub-langs ${langCode} --skip-download --sub-format vtt -o "${tempDir}\\%(title)s.%(ext)s" "${videoUrl}"`;
        console.log(`🛠️ Running subtitle extraction: ${command}`);
        
        const { stdout, stderr } = await execAsync(command);
        console.log(`📤 yt-dlp stdout:`, stdout);
        if (stderr) console.log(`📤 yt-dlp stderr:`, stderr);
        
        // Check for HTTP 429 rate limiting
        if (stderr && (stderr.includes('429') || stderr.includes('Too Many Requests'))) {
          console.log(`⚠️ Rate limit detected, will be retried by outer retry logic`);
          throw new Error('Rate limit exceeded (429)');
        }
        
        // Find the downloaded subtitle file for this language
        const files = fs.readdirSync(tempDir).filter((f: string) => f.endsWith(`.${langCode}.vtt`));
        
        if (files.length > 0) {
          const subtitleFile = path.join(tempDir, files[0]);
          const subtitleContent = fs.readFileSync(subtitleFile, 'utf8');
          
          console.log(`📄 Subtitle file found: ${subtitleFile} (${langCode})`);
          console.log(`📄 Subtitle content length: ${subtitleContent.length}`);
          
          // Parse WebVTT format and remove duplicates
          const lines = subtitleContent.split('\n');
          const textLines = lines
            .filter((line: string) => 
              !line.includes('-->') && 
              !line.startsWith('WEBVTT') && 
              !line.startsWith('NOTE') && 
              !line.startsWith('Kind:') &&
              !line.startsWith('Language:') &&
              line.trim()
            )
            .map((line: string) => line.replace(/<[^>]*>/g, '').trim()) // Clean HTML tags first
            .filter((line: string) => line.length > 0); // Remove empty lines
          
          // Remove consecutive duplicates and create clean text
          const uniqueLines = [];
          let lastLine = '';
          
          for (const line of textLines) {
            const cleanLine = line
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
            
            // Only add if it's different from the last line (prevents immediate duplicates)
            if (cleanLine !== lastLine && cleanLine.length > 0) {
              uniqueLines.push(cleanLine);
              lastLine = cleanLine;
            }
          }
          
          subtitleText = uniqueLines
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Apply additional deduplication for sentence-level duplicates
          subtitleText = removeDuplicatedSubtitleText(subtitleText);
          
          // Track files for cleanup
          downloadedFiles.push(subtitleFile);
          
          console.log(`✅ yt-dlp subtitle extraction successful with ${langCode}. Length: ${subtitleText.length}`);
          console.log(`📝 Preview: ${subtitleText.substring(0, 200)}...`);
          
          break; // Found subtitles, stop trying other languages
        } else {
          console.log(`  ❌ No subtitle file found for language: ${langCode}`);
        }
        
      } catch (langError) {
        console.log(`  ⚠️ Error with language ${langCode}:`, langError instanceof Error ? langError.message : 'Unknown error');
        // Check if it's a rate limit error and propagate it
        if (langError instanceof Error && langError.message.includes('429')) {
          throw langError;
        }
        // Continue to next language
      }
    }
    
    // Cleanup all temp files
    for (const file of downloadedFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`🧹 Cleaned up temp file: ${file}`);
        }
      } catch (cleanupError) {
        console.log(`⚠️ Failed to cleanup temp file:`, cleanupError);
      }
    }
    
    if (!subtitleText || subtitleText.length === 0) {
      console.log(`❌ No subtitles found in any supported language`);
      return null;
    }
    
    return subtitleText;
    
  }, 3, 2000); // Retry up to 3 times with 2 second base delay
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

    let fullTranscript: string | null = null;
    const transcriptionMethod = 'youtube' as const;

    // Method 1: Try yt-dlp (most reliable)
    console.log(`🔍 [1/2] Trying yt-dlp subtitle extraction for ${youtubeId}...`);
    fullTranscript = await extractSubtitlesWithYtDlp(youtubeId, language);
    
    if (fullTranscript && fullTranscript.length > 0) {
      console.log(`✅ yt-dlp successful. Length: ${fullTranscript.length}`);
    } else {
      console.log(`⚠️ yt-dlp failed, trying youtube-transcript library...`);
      
      // Method 2: Try youtube-transcript library
      console.log(`🔍 [2/2] Trying youtube-transcript library for ${youtubeId}...`);
      try {
        let transcriptData = null;
        const languagesToTry = [
          language || 'en',
          'auto',
          'en', 'en-US', 'en-GB',
          'pl'
        ];
        
        const uniqueLanguages = [...new Set(languagesToTry)];
        
        for (const lang of uniqueLanguages) {
          try {
            console.log(`  Trying language: ${lang}`);
            
            if (lang === 'auto') {
              transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId);
            } else {
              transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId, { lang });
            }
            
            if (transcriptData && transcriptData.length > 0) {
              console.log(`  ✓ Found ${transcriptData.length} segments with language: ${lang}`);
              break;
            }
          } catch {
            continue;
          }
        }
        
        if (transcriptData && transcriptData.length > 0) {
          fullTranscript = transcriptData
            .map(segment => segment.text || '')
            .filter(text => text.trim().length > 0)
            .join(' ');
          
          fullTranscript = removeDuplicatedSubtitleText(fullTranscript);
          console.log(`✅ YouTube transcript library successful. Length: ${fullTranscript.length}`);
        }
      } catch (error) {
        console.log(`⚠️ YouTube transcript library error:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // If no transcript found, return error
    if (!fullTranscript || fullTranscript.length === 0) {
      console.log(`❌ All subtitle extraction methods failed for ${youtubeId}`);
      throw new Error('Niestety YouTube nie udostępnia napisów dla tego filmu. Brak możliwości przeczytania video. Musisz obejrzeć aby ogarnąć co podmiot liryczny miał na myśli.');
    }
    
    console.log(`
📊 Final Result: ${transcriptionMethod} | ${fullTranscript.length} chars`);

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