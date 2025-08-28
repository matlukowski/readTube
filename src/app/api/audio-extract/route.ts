import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { extractAndTranscribeAudio, checkAudioExtractionAvailability } from '@/lib/audio-extractor';

// Audio extraction and transcription endpoint using Gladia API
export async function POST(request: NextRequest) {
  try {
    const { userId } = await authenticateRequest(request);

    const body = await request.json();
    const { youtubeId, language = 'auto' } = body;

    if (!youtubeId) {
      return NextResponse.json({ error: 'YouTube ID is required' }, { status: 400 });
    }

    try {
      console.log(`🎵 Starting audio extraction and transcription for ${youtubeId}`);
      
      const result = await extractAndTranscribeAudio(youtubeId, { language });
      
      return NextResponse.json({
        transcript: result.transcript,
        source: result.source,
        videoDetails: result.videoDetails,
        processingInfo: result.processingInfo
      });
      
    } catch (error) {
      console.error('❌ Audio extraction failed:', error);
      
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('Invalid YouTube ID')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes('too long')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes('Video unavailable')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        
        if (error.message.includes('age verification') || error.message.includes('Sign in')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        
        if (error.message.includes('copyright')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
      }
      
      throw error; // Re-throw for general error handling
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

    try {
      const result = await checkAudioExtractionAvailability(youtubeId);
      return NextResponse.json(result);
    } catch (error) {
      console.error('❌ Audio availability check failed:', error);
      return NextResponse.json({
        available: false,
        error: error instanceof Error ? error.message : 'Check failed'
      });
    }

  } catch (error) {
    console.error('❌ Audio availability check outer failed:', error);
    return NextResponse.json({
      available: false,
      error: 'Check failed'
    }, { status: 500 });
  }
}