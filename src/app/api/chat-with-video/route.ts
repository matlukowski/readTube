import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { formatTranscriptForAI } from '@/lib/transcript-formatter';
import { getCurrentUser } from '@/lib/auth';

interface ChatRequest {
  youtubeId: string;
  question: string;
  language?: string;
}

/**
 * Chat with video endpoint - allows users to ask questions about specific videos
 * Uses full transcript as context for AI responses
 */
export async function POST(request: NextRequest) {
  try {
    // Try reading request body once
    const body = await request.json();
    const { youtubeId, question, language = 'pl', googleId }: ChatRequest & { googleId: string } = body;
    
    // Get current user using Google OAuth
    const user = await getCurrentUser(googleId);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;

    // Validate input
    if (!youtubeId || !question) {
      return NextResponse.json({ 
        error: 'Missing required fields: youtubeId and question' 
      }, { status: 400 });
    }

    if (question.trim().length < 3) {
      return NextResponse.json({ 
        error: 'Question too short - minimum 3 characters' 
      }, { status: 400 });
    }

    if (question.length > 1000) {
      return NextResponse.json({ 
        error: 'Question too long - maximum 1000 characters' 
      }, { status: 400 });
    }

    console.log(`💬 Chat request: User ${userId} asking about video ${youtubeId}`);
    console.log(`💬 Question: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}`);

    // Step 1: Get video and transcript from database
    const video = await prisma.video.findUnique({
      where: { youtubeId },
      select: {
        id: true,
        title: true,
        transcript: true,
        summary: true,
        channelName: true,
        duration: true
      }
    });

    if (!video) {
      return NextResponse.json({
        error: 'Film nie został znaleziony',
        details: 'Ten film nie został jeszcze przeanalizowany. Przeanalizuj go najpierw na stronie głównej.',
        action: 'analyze_first'
      }, { status: 404 });
    }

    if (!video.transcript || video.transcript.trim().length === 0) {
      return NextResponse.json({
        error: 'Transkrypcja niedostępna',
        details: 'Ten film nie ma dostępnej transkrypcji do czatu.',
        action: 'transcript_missing'
      }, { status: 404 });
    }

    console.log(`📚 Found video: "${video.title}" with transcript (${video.transcript.length} chars)`);

    // Step 2: Format transcript for AI
    const formattedTranscript = formatTranscriptForAI(video.transcript);
    
    if (formattedTranscript.length === 0) {
      return NextResponse.json({
        error: 'Problem z transkrypcją',
        details: 'Transkrypcja nie mogła zostać sformatowana dla AI.'
      }, { status: 500 });
    }

    // Step 3: Initialize OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json({
        error: 'OpenAI API nie jest skonfigurowany'
      }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Step 4: Create AI prompt with full context
    const systemPrompt = language === 'pl' ? 
      `Jesteś ekspertem pomagającym użytkownikom zrozumieć treść filmu YouTube. Odpowiadaj WYŁĄCZNIE na podstawie podanej transkrypcji filmu.

ZASADY:
- Odpowiadaj konkretnie i pomocnie w języku polskim
- Jeśli informacji nie ma w transkrypcji, powiedz że nie ma jej w filmie  
- Cytuj fragmenty transkrypcji gdy to pomocne
- Bądź precyzyjny i rzeczowy
- Jeśli pytanie dotyczy szczegółów technicznych, wyjaśnij je dokładnie

TYTUŁ FILMU: ${video.title}
KANAŁ: ${video.channelName}
CZAS TRWANIA: ${video.duration || 'Nieznany'}

PEŁNA TRANSKRYPCJA FILMU:
${formattedTranscript}` :
      `You are an expert helping users understand YouTube video content. Answer ONLY based on the provided video transcript.

RULES:
- Answer specifically and helpfully in English
- If information isn't in the transcript, say it's not covered in the video
- Quote transcript fragments when helpful
- Be precise and factual
- If technical details are asked, explain them thoroughly

VIDEO TITLE: ${video.title}
CHANNEL: ${video.channelName}
DURATION: ${video.duration || 'Unknown'}

FULL VIDEO TRANSCRIPT:
${formattedTranscript}`;

    console.log(`🤖 Sending request to OpenAI (transcript: ${formattedTranscript.length} chars, question: ${question.length} chars)`);

    // Step 5: Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective for chat
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user', 
          content: question
        }
      ],
      max_tokens: 1000, // Reasonable limit for chat responses
      temperature: 0.7, // Balanced creativity and accuracy
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const answer = completion.choices[0]?.message?.content;
    
    if (!answer || answer.trim().length === 0) {
      return NextResponse.json({
        error: 'Nie otrzymano odpowiedzi od AI',
        details: 'Spróbuj zadać pytanie ponownie.'
      }, { status: 500 });
    }

    console.log(`✅ AI response generated: ${answer.length} characters`);

    // Step 6: Save chat to database
    try {
      await prisma.videoChat.create({
        data: {
          videoId: video.id,
          userId: userId,
          question: question.trim(),
          answer: answer.trim()
        }
      });
      console.log('💾 Chat saved to database');
    } catch (saveError) {
      console.error('❌ Failed to save chat to database:', saveError);
      // Don't fail the request if saving fails, just log it
    }

    // Step 7: Return response with metadata
    return NextResponse.json({
      answer: answer.trim(),
      videoInfo: {
        title: video.title,
        channelName: video.channelName,
        duration: video.duration,
        youtubeId: youtubeId
      },
      metadata: {
        transcriptLength: video.transcript.length,
        questionLength: question.length,
        answerLength: answer.length,
        model: 'gpt-4o-mini',
        language: language
      }
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json({
          error: 'Limit API został przekroczony',
          details: 'Spróbuj ponownie za chwilę.'
        }, { status: 429 });
      }
      
      if (error.message.includes('model_not_found')) {
        return NextResponse.json({
          error: 'Problem z modelem AI',
          details: 'Model AI jest tymczasowo niedostępny.'
        }, { status: 503 });
      }
    }
    
    return NextResponse.json({
      error: 'Wystąpił błąd podczas generowania odpowiedzi',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get chat history for a specific video
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const youtubeId = searchParams.get('youtubeId');
    const googleIdParam = searchParams.get('googleId');
    
    // Get current user using Google OAuth
    const user = await getCurrentUser(googleIdParam || undefined);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;

    if (!youtubeId) {
      return NextResponse.json({ 
        error: 'Missing youtubeId parameter' 
      }, { status: 400 });
    }

    // Get video to validate it exists
    const video = await prisma.video.findUnique({
      where: { youtubeId },
      select: { id: true, title: true }
    });

    if (!video) {
      return NextResponse.json({
        error: 'Film nie został znaleziony'
      }, { status: 404 });
    }

    // Get chat history
    const chats = await prisma.videoChat.findMany({
      where: {
        videoId: video.id,
        userId: userId
      },
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json({
      youtubeId,
      videoTitle: video.title,
      chats,
      totalChats: chats.length
    });

  } catch (error) {
    console.error('❌ Get chat history error:', error);
    return NextResponse.json({
      error: 'Nie udało się pobrać historii czatu',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}