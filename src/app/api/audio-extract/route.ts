import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import ytdl from '@distube/ytdl-core';
import { createGladiaClient } from '@/lib/gladia-client';

// Audio extraction and transcription endpoint using Gladia API
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { youtubeId, language = 'auto' } = body;

    if (!youtubeId) {
      return NextResponse.json({ error: 'YouTube ID is required' }, { status: 400 });
    }

    console.log(`🎵 Starting audio extraction and transcription for ${youtubeId}`);

    // Validate YouTube ID format
    if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      return NextResponse.json({ error: 'Invalid YouTube ID format' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    try {
      // Step 1: Get video info to check availability and get audio stream
      console.log('📡 Getting video info from YouTube...');
      const info = await ytdl.getInfo(videoUrl);
      
      if (!info) {
        throw new Error('Could not fetch video information');
      }

      console.log(`📊 Video info retrieved: "${info.videoDetails.title}"`);
      
      // Check video duration (limit to prevent abuse)
      const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
      const maxDuration = 30 * 60; // 30 minutes
      
      if (durationSeconds > maxDuration) {
        return NextResponse.json({
          error: `Video too long (${Math.round(durationSeconds/60)} minutes). Maximum allowed: ${maxDuration/60} minutes.`
        }, { status: 400 });
      }

      // Step 2: Get audio stream URL
      console.log('🎧 Finding best audio stream...');
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      
      if (!audioFormats.length) {
        throw new Error('No audio streams found for this video');
      }

      // Choose best audio format (prefer m4a/mp4a, fallback to webm)
      const bestAudio = audioFormats.find(f => 
        f.container === 'mp4' && f.audioCodec?.includes('mp4a')
      ) || audioFormats.find(f => 
        f.container === 'webm' && f.audioCodec?.includes('opus')
      ) || audioFormats[0];

      console.log(`🎵 Selected audio format: ${bestAudio.container} (${bestAudio.audioCodec})`);

      // Step 3: Stream audio directly to Gladia (no temp files)
      console.log('⬇️ Streaming audio for transcription...');
      const audioStream = ytdl(videoUrl, {
        format: bestAudio,
        highWaterMark: 1024 * 1024, // 1MB chunks
      });

      // Convert Node.js stream to buffer for Gladia
      const chunks: Buffer[] = [];
      
      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
        audioStream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        audioStream.on('error', reject);
      });

      console.log(`📦 Audio buffer ready: ${audioBuffer.length} bytes`);

      // Step 4: Send to Gladia for transcription
      console.log('🤖 Starting Gladia transcription...');
      const gladiaClient = createGladiaClient();
      
      const transcript = await gladiaClient.transcribeAudio(audioBuffer, {
        language: language === 'auto' ? undefined : language,
        diarization: false, // Disable for faster processing
        code_switching: true, // Enable multiple languages
      }, 300000); // 5 minute timeout

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Transcription completed but resulted in empty text');
      }

      console.log(`✅ Audio transcription completed: ${transcript.length} characters`);

      return NextResponse.json({
        transcript: transcript.trim(),
        source: 'gladia-audio',
        videoDetails: {
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds,
          author: info.videoDetails.author?.name
        },
        processingInfo: {
          audioFormat: bestAudio.container,
          audioCodec: bestAudio.audioCodec,
          durationSeconds,
          transcriptionLength: transcript.length
        }
      });

    } catch (ytdlError) {
      console.error('❌ YouTube audio extraction failed:', ytdlError);
      
      // Check if it's a blocking/access issue
      if (ytdlError instanceof Error) {
        if (ytdlError.message.includes('Video unavailable')) {
          return NextResponse.json({
            error: 'Video is not available or may be private/restricted'
          }, { status: 404 });
        }
        
        if (ytdlError.message.includes('Sign in to confirm')) {
          return NextResponse.json({
            error: 'Video requires age verification or sign-in'
          }, { status: 403 });
        }
        
        if (ytdlError.message.includes('copyright')) {
          return NextResponse.json({
            error: 'Video may be copyright-restricted'
          }, { status: 403 });
        }
      }
      
      throw ytdlError; // Re-throw for general error handling
    }

  } catch (error) {
    console.error('❌ Audio extraction API error:', error);
    
    return NextResponse.json({
      error: 'Audio transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check if audio extraction is available for a video
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const youtubeId = request.nextUrl.searchParams.get('id');
    
    if (!youtubeId) {
      return NextResponse.json({ error: 'YouTube ID is required' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    try {
      // Quick check if video is accessible
      const info = await ytdl.getBasicInfo(videoUrl);
      const durationSeconds = parseInt(info.videoDetails.lengthSeconds || '0');
      const maxDuration = 30 * 60; // 30 minutes
      
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      
      return NextResponse.json({
        available: audioFormats.length > 0,
        duration: durationSeconds,
        tooLong: durationSeconds > maxDuration,
        title: info.videoDetails.title,
        audioFormatsCount: audioFormats.length
      });
      
    } catch (error) {
      return NextResponse.json({
        available: false,
        error: error instanceof Error ? error.message : 'Video check failed'
      });
    }

  } catch (error) {
    console.error('❌ Audio availability check failed:', error);
    return NextResponse.json({
      available: false,
      error: 'Check failed'
    }, { status: 500 });
  }
}