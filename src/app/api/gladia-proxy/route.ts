import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Proxy endpoint for Gladia API to hide API key from client
 * Handles complete workflow: upload → transcription → polling → result
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Gladia API key is configured
    if (!process.env.GLADIA_API_KEY) {
      return NextResponse.json({ 
        error: 'Gladia API key not configured' 
      }, { status: 500 });
    }

    console.log('🔐 Gladia proxy: Processing client request');
    
    // Get form data from client
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'auto';
    const diarization = formData.get('diarization') === 'true';

    if (!audioFile) {
      return NextResponse.json({ 
        error: 'No audio file provided' 
      }, { status: 400 });
    }

    console.log(`📤 Uploading audio file: ${audioFile.name} (${audioFile.size} bytes)`);
    console.log(`🔧 Config: language=${language}, diarization=${diarization}`);

    // Step 1: Upload file to Gladia
    console.log('📤 Step 1: Uploading file to Gladia...');
    const uploadFormData = new FormData();
    uploadFormData.append('audio', audioFile);

    const uploadResponse = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': process.env.GLADIA_API_KEY,
      },
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      console.error('❌ Gladia upload failed:', errorData);
      return NextResponse.json({ 
        error: `Upload failed: ${uploadResponse.status}`,
        details: errorData 
      }, { status: 422 });
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ File uploaded, audio_url:', uploadResult.audio_url);

    // Step 2: Request transcription
    console.log('🚀 Step 2: Starting transcription...');
    const transcriptionPayload = {
      audio_url: uploadResult.audio_url,
      language: language === 'auto' ? undefined : language,
      diarization: diarization,
    };

    const transcriptionResponse = await fetch('https://api.gladia.io/v2/pre-recorded', {
      method: 'POST',
      headers: {
        'x-gladia-key': process.env.GLADIA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptionPayload)
    });

    if (!transcriptionResponse.ok) {
      const errorData = await transcriptionResponse.text();
      console.error('❌ Gladia transcription request failed:', errorData);
      return NextResponse.json({ 
        error: `Transcription request failed: ${transcriptionResponse.status}`,
        details: errorData 
      }, { status: 422 });
    }

    const transcriptionResult = await transcriptionResponse.json();
    console.log('✅ Transcription started, ID:', transcriptionResult.id);

    // Step 3: Poll for result
    console.log('⏳ Step 3: Polling for transcription result...');
    const resultUrl = `https://api.gladia.io/v2/pre-recorded/${transcriptionResult.id}`;
    
    // Poll with exponential backoff
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Wait before checking (exponential backoff)
      const waitTime = Math.min(1000 + (attempts * 500), 10000); // 1.5s to 10s
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      console.log(`🔄 Polling attempt ${attempts}/${maxAttempts}...`);
      
      const resultResponse = await fetch(resultUrl, {
        headers: {
          'x-gladia-key': process.env.GLADIA_API_KEY,
        }
      });

      if (!resultResponse.ok) {
        console.error('❌ Failed to check transcription status');
        continue;
      }

      const result = await resultResponse.json();
      console.log(`📊 Status: ${result.status}`);

      if (result.status === 'done') {
        console.log('✅ Transcription completed!');
        
        const transcript = result.result?.transcription?.full_transcript;
        
        if (!transcript || transcript.trim().length === 0) {
          return NextResponse.json({ 
            error: 'Transcription completed but result is empty' 
          }, { status: 422 });
        }

        console.log(`📝 Transcript length: ${transcript.length} characters`);
        
        return NextResponse.json({ 
          transcript: transcript.trim(),
          source: 'client-side-gladia',
          processingInfo: {
            attempts,
            audioSize: audioFile.size,
            language,
            diarization
          }
        });
        
      } else if (result.status === 'error') {
        console.error('❌ Transcription failed:', result.error);
        return NextResponse.json({ 
          error: 'Transcription failed',
          details: result.error 
        }, { status: 422 });
      }
      
      // Status is still 'processing' or 'queued', continue polling
    }

    // Timeout reached
    console.error('⏰ Transcription timeout after', attempts, 'attempts');
    return NextResponse.json({ 
      error: 'Transcription timeout',
      details: 'Transcription took too long to complete' 
    }, { status: 408 });

  } catch (error) {
    console.error('❌ Gladia proxy error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}