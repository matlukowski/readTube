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
      console.log('🔙 Backend returning cached transcript. Length:', existingVideo.transcript?.length || 'NO TRANSCRIPT');
      return NextResponse.json({ 
        transcript: existingVideo.transcript,
        cached: true 
      });
    }

    let fullTranscript: string;
    let transcriptionMethod: 'youtube' | 'whisper';

    try {
      // Try YouTube Subtitles/Captions first (free and fast)
      console.log(`🔍 Fetching YouTube subtitles for ${youtubeId}...`);
      
      // Try multiple approaches to get subtitles
      let transcriptData;
      const languagesToTry = ['auto', 'en', 'pl', language || 'en'];
      
      for (const lang of languagesToTry) {
        try {
          console.log(`🔍 Trying language: ${lang}`);
          if (lang === 'auto') {
            // Try without language specification (auto-detect)
            transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId);
          } else {
            transcriptData = await YoutubeTranscript.fetchTranscript(youtubeId, { lang });
          }
          console.log(`✅ Successfully fetched subtitles with language: ${lang}`);
          break;
        } catch (langError) {
          console.log(`❌ Failed with language ${lang}:`, langError.message);
          continue;
        }
      }
      
      if (!transcriptData) {
        throw new Error('No subtitles available in any language');
      }

      console.log(`🔍 Raw transcript data:`, transcriptData);
      console.log(`🔍 Transcript segments count:`, transcriptData?.length || 0);
      console.log(`🔍 First segment:`, transcriptData?.[0]);
      console.log(`🔍 Last segment:`, transcriptData?.[transcriptData?.length - 1]);

      fullTranscript = transcriptData
        .map(segment => {
          console.log(`🔍 Processing segment:`, segment);
          return segment.text;
        })
        .join(' ');
      
      console.log(`🔍 Mapped transcript length:`, fullTranscript?.length || 0);
      console.log(`🔍 Mapped transcript preview:`, fullTranscript?.substring(0, 200) || 'EMPTY');
      
      transcriptionMethod = 'youtube';
      console.log(`✅ YouTube subtitles found for ${youtubeId}`);
    } catch (youtubeError) {
      console.log(`⚠️ YouTube subtitles failed for ${youtubeId}, trying Whisper...`);
      
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

    console.log('🔙 Backend returning transcript. Length:', fullTranscript?.length || 'NO TRANSCRIPT');
    console.log('🔙 Backend transcript preview:', fullTranscript?.substring(0, 100) || 'EMPTY');
    
    const responseData = { 
      transcript: fullTranscript,
      cached: false,
      method: transcriptionMethod
    };
    
    console.log('🔙 Backend response data:', JSON.stringify(responseData, null, 2));
    
    return NextResponse.json(responseData);
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