import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { getYouTubeTranscriptWithRetry } from '@/lib/youtube-transcript-extractor';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { getAIService } from '@/lib/ai';

// Get transcript from YouTube using direct extraction (GetSubs-style)
async function getYouTubeTranscript(youtubeId: string): Promise<string | null> {
  console.log(`🚀 Starting GetSubs-style transcript extraction for ${youtubeId}`);
  
  // Use our robust direct extraction method
  return await getYouTubeTranscriptWithRetry(youtubeId, 3);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await authenticateRequest(request);

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

    // New simplified workflow: YouTube Captions Only
    console.log(`🚀 Starting transcription workflow for ${youtubeId}`);
    
    // Get transcript from YouTube captions (manual or automatic)
    const fullTranscript = await getYouTubeTranscript(youtubeId);
    
    if (!fullTranscript || fullTranscript.length === 0) {
      return NextResponse.json({
        error: 'Brak możliwości wykonania podsumowania dla tego filmu'
      }, { status: 422 });
    }
    
    console.log(`📊 Transcript extracted: ${fullTranscript.length} characters`);

    // Generate summary using AI
    const ai = getAIService();
    const summary = await ai.summarizeTranscript(fullTranscript, {
      style: 'paragraph',
      maxLength: 2500,
      language: 'pl',
    });

    const enrichedSummary = {
      summary,
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
    
    return NextResponse.json(
      { error: 'Brak możliwości wykonania podsumowania dla tego filmu' },
      { status: 422 }
    );
  }
}