import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { getAIService } from '@/lib/ai';

// Reuse the same functions from transcribe/route.ts
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
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const tempDir = require('path').join(process.cwd(), 'temp');
    if (!require('fs').existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir, { recursive: true });
    }
    
    const command = `yt-dlp --write-auto-subs --sub-langs en --skip-download --sub-format vtt -o "${tempDir}\\\\%(title)s.%(ext)s" "${videoUrl}"`;
    console.log(`🛠️ Running subtitle extraction: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    console.log(`📤 yt-dlp stdout:`, stdout);
    if (stderr) console.log(`📤 yt-dlp stderr:`, stderr);
    
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
    const lines = subtitleContent.split('\\n');
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
      .replace(/\\s+/g, ' ');
    
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
    
    const playerConfigMatch = html.match(/ytInitialPlayerResponse\\s*=\\s*({.+?});/);
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
    
    let selectedCaption = captions.find((c: any) => c.kind === 'asr' && c.languageCode?.startsWith('en')) ||
                         captions.find((c: any) => c.languageCode?.startsWith('en')) ||
                         captions[0];
    
    if (!selectedCaption) {
      console.log(`❌ No suitable caption track found`);
      return null;
    }
    
    console.log(`✅ Selected caption: ${selectedCaption.name?.simpleText} (${selectedCaption.languageCode})`);
    
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
    
    const textMatches = xmlContent.match(/<text[^>]*>(.*?)<\\/text>/g);
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
      .replace(/\\s+/g, ' ');
    
    console.log(`✅ Direct API subtitle extraction successful. Length: ${subtitleText.length}`);
    console.log(`📝 Preview: ${subtitleText.substring(0, 200)}...`);
    
    return subtitleText;
    
  } catch (error) {
    console.error(`❌ Direct API subtitle extraction failed:`, error);
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
    const { youtubeId } = transcribeRequestSchema.parse(body);

    // Check if we already have cached summary
    const existingVideo = await prisma.video.findUnique({
      where: { youtubeId },
      select: { transcript: true, summary: true },
    });

    if (existingVideo?.summary) {
      console.log('🔙 Backend returning cached summary');
      try {
        const summaryData = JSON.parse(existingVideo.summary);
        return NextResponse.json({ 
          ...summaryData,
          cached: true 
        });
      } catch {
        // If parsing fails, continue with generation
      }
    }

    let fullTranscript: string;

    // Get transcript using the same multi-tier fallback strategy
    try {
      // Method 1: Try yt-dlp (most reliable)
      console.log(`🔍 Trying yt-dlp subtitle extraction for ${youtubeId}...`);
      const ytDlpResult = await extractSubtitlesWithYtDlp(youtubeId);
      
      if (ytDlpResult && ytDlpResult.length > 0) {
        fullTranscript = ytDlpResult;
        console.log(`✅ yt-dlp subtitle extraction successful`);
      } else {
        console.log(`⚠️ yt-dlp failed, trying direct API approach...`);
        
        // Method 2: Try direct YouTube API approach
        const directAPIResult = await extractSubtitlesDirectAPI(youtubeId);
        
        if (directAPIResult && directAPIResult.length > 0) {
          fullTranscript = directAPIResult;
          console.log(`✅ Direct API subtitle extraction successful`);
        } else {
          console.log(`⚠️ Direct API failed, trying youtube-transcript library...`);
          
          // Method 3: Fallback to youtube-transcript library
          const languagesToTry = ['auto', 'en', 'en-US', 'en-GB', 'pl', 'pl-PL'];
          let transcriptData = null;
          
          for (const lang of languagesToTry) {
            try {
              console.log(`🔍 Trying language: ${lang}`);
              
              if (lang === 'auto') {
                transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId);
              } else {
                transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId, { lang });
              }
              
              if (transcriptData && transcriptData.length > 0) {
                console.log(`✅ Successfully fetched subtitles with language: ${lang}`);
                break;
              }
            } catch (langError) {
              continue;
            }
          }
          
          if (!transcriptData) {
            throw new Error('No subtitles available in any language');
          }

          fullTranscript = transcriptData
            .map(segment => segment.text || '')
            .filter(text => text.trim().length > 0)
            .join(' ');

          console.log(`✅ YouTube transcript library fallback successful`);
        }
      }
      
      console.log(`🔍 Final transcript length:`, fullTranscript?.length || 0);
    } catch (transcriptError) {
      console.error('All transcript methods failed:', transcriptError);
      throw new Error('Transcript not available');
    }

    // Generate summary using AI
    const ai = getAIService();
    const summary = await ai.summarizeTranscript(fullTranscript, {
      style: 'paragraph',
      maxLength: 500,
    });

    // Extract additional insights
    const [topics, questions] = await Promise.all([
      ai.extractKeyTopics(fullTranscript),
      ai.generateQuestions(fullTranscript),
    ]);

    const enrichedSummary = {
      summary,
      topics,
      questions,
      generatedAt: new Date().toISOString(),
    };

    // Save to database
    await prisma.video.upsert({
      where: { youtubeId },
      update: { 
        transcript: fullTranscript,
        summary: JSON.stringify(enrichedSummary),
      },
      create: {
        youtubeId,
        title: 'Pending',
        channelName: 'Pending',
        thumbnail: '',
        transcript: fullTranscript,
        summary: JSON.stringify(enrichedSummary),
      },
    });

    console.log('🔙 Backend returning generated summary');
    
    return NextResponse.json({ 
      ...enrichedSummary,
      cached: false 
    });
  } catch (error) {
    console.error('Transcribe and summarize API error:', error);
    
    if (error instanceof Error) {
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
      { error: 'Failed to analyze video' },
      { status: 500 }
    );
  }
}