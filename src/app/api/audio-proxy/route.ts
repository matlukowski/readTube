import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import ytdl from '@distube/ytdl-core';

/**
 * Audio proxy endpoint - streams YouTube audio to bypass CORS
 * Uses rotating user agents and retry logic for reliability
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const youtubeId = request.nextUrl.searchParams.get('id');
    if (!youtubeId) {
      return NextResponse.json({ error: 'YouTube ID is required' }, { status: 400 });
    }

    // Validate YouTube ID format
    if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      return NextResponse.json({ error: 'Invalid YouTube ID format' }, { status: 400 });
    }

    console.log(`🎵 Audio proxy: Processing request for ${youtubeId}`);
    
    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    
    // Retry logic with different user agents
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const userAgent = getRandomUserAgent();
      console.log(`🔄 Attempt ${attempt}/${maxRetries} with user agent: ${userAgent.substring(0, 50)}...`);
      
      try {
        // Configure ytdl with anti-bot headers (agent creation for future use)
        // const agent = ytdl.createAgent(undefined, { localAddress: undefined });
        
        // Step 1: Get video info
        console.log('📡 Getting video info...');
        const info = await ytdl.getInfo(videoUrl, {
          requestOptions: {
            headers: {
              'User-Agent': userAgent,
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          }
        });
        
        console.log(`📊 Video: "${info.videoDetails.title}"`);
        
        // Step 2: Check duration (60 minute limit)
        const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
        const maxDuration = 60 * 60; // 60 minutes
        
        if (durationSeconds > maxDuration) {
          return NextResponse.json({ 
            error: `Video too long (${Math.round(durationSeconds/60)} minutes). Maximum: ${Math.round(maxDuration/60)} minutes.` 
          }, { status: 400 });
        }
        
        // Step 3: Find best audio format
        console.log('🎧 Finding best audio format...');
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        if (!audioFormats.length) {
          return NextResponse.json({ 
            error: 'No audio formats available for this video' 
          }, { status: 404 });
        }
        
        // Choose best audio format (prefer mp4/m4a, fallback to webm)
        const bestAudio = audioFormats.find(f => 
          f.container === 'mp4' && f.audioCodec?.includes('mp4a')
        ) || audioFormats.find(f => 
          f.container === 'webm' && f.audioCodec?.includes('opus')  
        ) || audioFormats[0];
        
        console.log(`🎵 Selected format: ${bestAudio.container} (${bestAudio.audioCodec})`);
        
        // Step 4: Create audio stream
        console.log('⬇️ Creating audio stream...');
        const audioStream = ytdl(videoUrl, {
          format: bestAudio,
          requestOptions: {
            headers: {
              'User-Agent': userAgent,
              'Accept-Language': 'en-US,en;q=0.9',
            }
          },
          highWaterMark: 1024 * 1024, // 1MB chunks
        });
        
        // Set headers for audio response
        const headers = new Headers({
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="youtube_${youtubeId}.mp3"`,
          'Cache-Control': 'public, max-age=3600', // 1 hour cache
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        });
        
        // Stream the audio data
        console.log('🚀 Streaming audio data to client...');
        
        // Create a ReadableStream from the ytdl stream
        const readableStream = new ReadableStream({
          start(controller) {
            audioStream.on('data', (chunk) => {
              controller.enqueue(new Uint8Array(chunk));
            });
            
            audioStream.on('end', () => {
              console.log('✅ Audio stream completed');
              controller.close();
            });
            
            audioStream.on('error', (error) => {
              console.error('❌ Audio stream error:', error);
              controller.error(error);
            });
          }
        });
        
        return new Response(readableStream, { headers });
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        lastError = error;
        
        if (error instanceof Error) {
          // If it's a bot detection error, try next user agent
          if (error.message.includes('Sign in to confirm') || 
              error.message.includes('bot') ||
              error.message.includes('captcha')) {
            console.log('🤖 Bot detection encountered, trying different user agent...');
            if (attempt < maxRetries) {
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            }
          }
          
          // If it's a video availability error, don't retry
          if (error.message.includes('Video unavailable') || 
              error.message.includes('private') ||
              error.message.includes('deleted')) {
            return NextResponse.json({ 
              error: 'Video is not available or may be private/restricted' 
            }, { status: 404 });
          }
        }
        
        // For other errors, continue retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
      }
    }
    
    // All attempts failed
    console.error('❌ All retry attempts failed. Last error:', lastError);
    
    const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
    
    // Enhanced error detection and messaging
    if (errorMessage.includes('Sign in to confirm') || errorMessage.includes('bot') || errorMessage.includes('captcha')) {
      return NextResponse.json({ 
        error: 'YouTube wykrył automatyczne requesty i blokuje dostęp',
        details: 'Zalecamy użycie autoryzacji YouTube OAuth2 dla stabilnego dostępu do filmów.',
        recommendation: 'Autoryzuj YouTube na stronie głównej aplikacji',
        technicalDetails: errorMessage
      }, { status: 429 });
    }
    
    if (errorMessage.includes('Video unavailable') || errorMessage.includes('private') || errorMessage.includes('deleted')) {
      return NextResponse.json({ 
        error: 'Film nie jest dostępny',
        details: 'Film może być prywatny, usunięty lub ograniczony geograficznie.',
        suggestion: 'Spróbuj z innym publicznie dostępnym filmem',
        technicalDetails: errorMessage
      }, { status: 404 });
    }
    
    if (errorMessage.includes('No formats found') || errorMessage.includes('No audio formats')) {
      return NextResponse.json({ 
        error: 'Brak dostępnych formatów audio dla tego filmu',
        details: 'YouTube może ograniczać dostęp do audio dla tego konkretnego filmu.',
        suggestion: 'Spróbuj z filmem z innego kanału lub użyj autoryzacji YouTube',
        technicalDetails: errorMessage
      }, { status: 422 });
    }
    
    // Generic error with helpful suggestions
    return NextResponse.json({ 
      error: 'Nie udało się pobrać audio po kilku próbach',
      details: 'YouTube coraz częściej blokuje automatyczne pobieranie audio.',
      recommendations: [
        '🔐 Autoryzuj YouTube OAuth2 dla pewnego dostępu',
        '🎬 Spróbuj z innym filmem YouTube',
        '📝 Wybierz film który ma widoczne napisy'
      ],
      technicalDetails: errorMessage,
      debugInfo: {
        attempts: maxRetries,
        userAgentsUsed: USER_AGENTS.length,
        ytdlCoreVersion: 'Using @distube/ytdl-core',
        serverLocation: 'Vercel Edge Runtime'
      }
    }, { status: 500 });

  } catch (error) {
    console.error('❌ Audio proxy error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}