import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { getAIService } from '@/lib/ai';

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
      return NextResponse.json({ 
        transcript: existingVideo.transcript,
        cached: true 
      });
    }

    let fullTranscript: string;
    let transcriptionMethod: 'youtube' | 'whisper';

    try {
      // Try YouTube Transcript API first (free and fast)
      const transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId, {
        lang: language,
      });

      fullTranscript = transcriptData
        .map(segment => segment.text)
        .join(' ');
      
      transcriptionMethod = 'youtube';
      console.log(`✅ YouTube transcript found for ${youtubeId}`);
    } catch (youtubeError) {
      console.log(`⚠️ YouTube transcript failed for ${youtubeId}, trying Whisper...`);
      
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

    return NextResponse.json({ 
      transcript: fullTranscript,
      cached: false,
      method: transcriptionMethod
    });
  } catch (error) {
    console.error('Transcribe API error:', error);
    
    // Handle specific youtube-transcript errors
    if (error instanceof Error) {
      if (error.message.includes('Could not find')) {
        return NextResponse.json(
          { error: 'Transcript not available for this video' },
          { status: 404 }
        );
      }
      if (error.message.includes('Disabled')) {
        return NextResponse.json(
          { error: 'Transcripts are disabled for this video' },
          { status: 403 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}