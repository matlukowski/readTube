import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAIService } from '@/lib/ai';
import { summarizeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transcript, maxLength, style } = summarizeRequestSchema.parse(body);
    const { youtubeId } = body; // Optional, for caching

    // Check if summary already exists
    if (youtubeId) {
      const existingVideo = await prisma.video.findUnique({
        where: { youtubeId },
        select: { summary: true },
      });

      if (existingVideo?.summary) {
        return NextResponse.json({ 
          summary: existingVideo.summary,
          cached: true 
        });
      }
    }

    // Generate summary using AI
    const ai = getAIService();
    const summary = await ai.summarizeTranscript(transcript, {
      style,
      maxLength,
    });

    // Extract additional insights
    const [topics, questions] = await Promise.all([
      ai.extractKeyTopics(transcript),
      ai.generateQuestions(transcript),
    ]);

    const enrichedSummary = {
      summary,
      topics,
      questions,
      generatedAt: new Date().toISOString(),
    };

    // Save summary to database if youtubeId provided
    if (youtubeId) {
      await prisma.video.update({
        where: { youtubeId },
        data: { 
          summary: JSON.stringify(enrichedSummary),
        },
      });
    }

    return NextResponse.json({ 
      ...enrichedSummary,
      cached: false 
    });
  } catch (error) {
    console.error('Summarize API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}