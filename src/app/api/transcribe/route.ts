import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { YoutubeTranscript } from 'youtube-transcript';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

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

    // Fetch transcript from YouTube
    const transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId, {
      lang: language,
    });

    // Combine transcript segments
    const fullTranscript = transcriptData
      .map(segment => segment.text)
      .join(' ');

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
      cached: false 
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