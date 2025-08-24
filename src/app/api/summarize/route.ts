import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAIService } from '@/lib/ai';
import { summarizeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Try both authentication systems during migration
    let userId: string | null = null;
    let googleId: string | undefined = undefined;
    
    // Method 1: Try Google OAuth (new system)
    try {
      const body = await request.clone().json();
      if (body.googleId && typeof body.googleId === 'string') {
        googleId = body.googleId;
        // Get user by googleId to get database userId
        const user = await prisma.user.findUnique({
          where: { googleId: googleId },
          select: { id: true }
        });
        if (user) {
          userId = user.id;
        }
      }
    } catch {
      // Body might not have googleId, continue
    }
    
    // Method 2: Fallback to Clerk (old system)
    if (!userId) {
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        // Get user by clerkId
        const user = await prisma.user.findUnique({
          where: { clerkId: clerkAuth.userId },
          select: { id: true, googleId: true }
        });
        if (user) {
          userId = user.id;
          googleId = user.googleId || undefined; // Convert null to undefined
        }
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transcript, maxLength, style, language } = summarizeRequestSchema.parse(body);
    const { youtubeId } = body; // Optional, for caching

    // Check if summary already exists
    if (youtubeId) {
      const existingVideo = await prisma.video.findUnique({
        where: { youtubeId },
        select: { summary: true },
      });

      if (existingVideo?.summary) {
        try {
          const parsed = JSON.parse(existingVideo.summary);
          return NextResponse.json({ 
            summary: parsed.summary || existingVideo.summary,
            generatedAt: parsed.generatedAt,
            cached: true 
          });
        } catch {
          return NextResponse.json({ 
            summary: existingVideo.summary,
            cached: true 
          });
        }
      }
    }

    // Generate summary using AI
    const ai = getAIService();
    const summary = await ai.summarizeTranscript(transcript, {
      style,
      maxLength,
      language: language || 'pl',
    });

    const enrichedSummary = {
      summary,
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