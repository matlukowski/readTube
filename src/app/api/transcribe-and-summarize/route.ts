import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { TranscriptList } from '@osiris-ai/youtube-captions-sdk';
import { transcribeRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { getAIService } from '@/lib/ai';

// Get transcript from YouTube captions using modern SDK
async function getYouTubeTranscript(youtubeId: string): Promise<string | null> {
  try {
    console.log(`🎬 Fetching YouTube captions for ${youtubeId}...`);
    
    // Pobierz listę dostępnych transkryptów
    const transcriptList = await TranscriptList.fetch(youtubeId);
    
    if (!transcriptList) {
      console.log(`❌ No transcript list available for ${youtubeId}`);
      return null;
    }
    
    console.log(`📋 Transcript list retrieved for ${youtubeId}`);
    
    // Próbuj różne języki w kolejności preferencji
    const languagePreferences = [
      ['pl', 'pl-PL'],           // Polski
      ['en', 'en-US', 'en-GB'],  // Angielski
      ['es', 'de', 'fr', 'it']   // Inne popularne języki
    ];
    
    for (const languages of languagePreferences) {
      try {
        console.log(`🔍 Trying languages: ${languages.join(', ')}`);
        const transcript = transcriptList.find(languages);
        
        if (transcript) {
          console.log(`✅ Found transcript in languages: ${languages.join(', ')}`);
          
          // Pobierz zawartość transkryptu
          const fetchedTranscript = await transcript.fetch();
          
          if (fetchedTranscript && fetchedTranscript.snippets) {
            console.log(`📝 Retrieved ${fetchedTranscript.snippets.length} transcript snippets`);
            
            // Konwertuj snippets do czystego tekstu
            const plainText = fetchedTranscript.snippets
              .map((snippet: { text?: string }) => snippet.text || '')
              .join(' ')
              .replace(/\[.*?\]/g, '')     // Remove [Music], etc.
              .replace(/\(.*?\)/g, '')     // Remove (noise), etc.
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, ' ')
              .trim();
            
            if (plainText.length > 0) {
              console.log(`✅ Transcript extracted: ${plainText.length} characters`);
              console.log(`📝 Preview: ${plainText.substring(0, 200)}...`);
              return plainText;
            }
          }
        }
      } catch {
        console.log(`Failed to fetch transcript for ${languages.join(', ')}, trying next...`);
        continue;
      }
    }
    
    // Jeśli określone języki nie zadziałały, spróbuj pobrać pierwszy dostępny
    console.log(`⚠️ No preferred languages found, trying first available transcript...`);
    try {
      // Spróbuj pobrać jakikolwiek dostępny transkrypt
      // Użyjmy metody find bez argumentów, aby pobrać pierwszy dostępny
      const transcript = transcriptList.find([]);
      
      if (transcript) {
        // Pobierz pierwszy dostępny bez względu na język
        const fetchedTranscript = await transcript.fetch();
        
        if (fetchedTranscript && fetchedTranscript.snippets) {
          console.log(`✅ Found fallback transcript with ${fetchedTranscript.snippets.length} snippets`);
          
          const plainText = fetchedTranscript.snippets
            .map((snippet: { text?: string }) => snippet.text || '')
            .join(' ')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          if (plainText.length > 0) {
            console.log(`✅ Fallback transcript extracted: ${plainText.length} characters`);
            return plainText;
          }
        }
      }
    } catch (fallbackError) {
      console.log(`❌ Could not fetch any available transcript:`, fallbackError);
    }
    
    console.log(`❌ No captions found for ${youtubeId} using any method`);
    return null;
    
  } catch (error) {
    console.error(`❌ YouTube captions extraction failed:`, error);
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