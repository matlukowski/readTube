// Client-side YouTube audio extraction
// Uses external API to bypass ytdl-core browser issues

export interface ClientAudioExtractionResult {
  audioBlob: Blob;
  title: string;
  duration: number;
  size: number;
}

export interface ClientAudioExtractionOptions {
  maxDuration?: number; // in seconds, default 60 minutes
  onProgress?: (progress: string) => void;
}

/**
 * Extract audio from YouTube video on client-side using Cobalt API
 */
export async function extractAudioClientSide(
  youtubeId: string,
  options: ClientAudioExtractionOptions = {}
): Promise<ClientAudioExtractionResult> {
  const { maxDuration = 60 * 60, onProgress } = options;
  
  console.log(`🎵 Starting client-side audio extraction for ${youtubeId}`);
  onProgress?.('Pobieranie informacji o filmie...');

  // Validate YouTube ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    throw new Error('Invalid YouTube ID format');
  }

  // videoUrl not used directly, but kept for potential debugging
  
  try {
    // Step 1: Use our own audio proxy endpoint
    onProgress?.('Łączenie z proxy serwera...');
    console.log('🔗 Step 1: Getting audio from our proxy endpoint...');
    
    const proxyResponse = await fetch(`/api/audio-proxy?id=${youtubeId}`, {
      method: 'GET',
      headers: {
        'Accept': 'audio/mpeg, */*',
      }
    });

    if (!proxyResponse.ok) {
      const errorData = await proxyResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Audio proxy failed: ${proxyResponse.status} - ${errorData.error}`);
    }

    console.log('✅ Connected to audio proxy');
    
    // Step 2: Stream audio data with progress tracking
    onProgress?.('Pobieranie pliku audio...');
    console.log('⬇️ Step 2: Streaming audio data...');
    
    if (!proxyResponse.body) {
      throw new Error('No audio data received from proxy');
    }

    // Read the stream with progress tracking
    const reader = proxyResponse.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      if (value) {
        chunks.push(value);
        totalSize += value.length;
        
        // Update progress every MB
        if (totalSize % (1024 * 1024) < value.length) {
          const sizeMB = Math.round(totalSize / 1024 / 1024);
          onProgress?.(`Pobieranie audio... ${sizeMB}MB`);
        }
      }
    }
    
    console.log(`✅ Audio download complete: ${totalSize} bytes`);
    
    // Create blob from chunks
    const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
    
    // Estimate duration (rough calculation based on typical bitrates)
    const estimatedDuration = Math.min(totalSize / 16000, maxDuration); // ~128kbps estimate
    
    const result: ClientAudioExtractionResult = {
      audioBlob,
      title: `YouTube Video ${youtubeId}`, // We don't have title from proxy
      duration: estimatedDuration,
      size: totalSize
    };
    
    console.log(`🎉 Client-side extraction complete: ${Math.round(totalSize/1024/1024)}MB`);
    onProgress?.('Audio pobrane pomyślnie!');
    
    return result;

  } catch (error) {
    console.error('❌ Client-side audio extraction failed:', error);
    
    // Enhanced error messages
    if (error instanceof Error) {
      if (error.message.includes('Video unavailable') || error.message.includes('not found')) {
        throw new Error('Film nie jest dostępny lub może być prywatny');
      }
      
      if (error.message.includes('copyright')) {
        throw new Error('Film może być chroniony prawami autorskimi');
      }
      
      if (error.message.includes('zbyt długi')) {
        throw error; // Pass through duration error
      }

      if (error.message.includes('Audio proxy failed') || error.message.includes('proxy')) {
        throw new Error('Serwer audio jest niedostępny - spróbuj ponownie później');
      }
    }
    
    throw new Error(`Nie można wyodrębnić audio: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
  }
}

/**
 * Upload audio blob to Gladia via proxy
 */
export async function uploadAudioToGladia(
  audioBlob: Blob, 
  config: { language?: string; diarization?: boolean } = {},
  onProgress?: (progress: string) => void
): Promise<string> {
  console.log('🚀 Uploading audio to Gladia via proxy...');
  onProgress?.('Wysyłanie audio do Gladia...');
  
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.mp3');
  formData.append('language', config.language || 'auto');
  formData.append('diarization', config.diarization ? 'true' : 'false');
  
  try {
    const response = await fetch('/api/gladia-proxy', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gladia upload failed: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log('✅ Audio uploaded to Gladia:', result.id);
    onProgress?.('Audio wysłane pomyślnie!');
    
    return result.transcript;
    
  } catch (error) {
    console.error('❌ Gladia upload failed:', error);
    throw new Error(`Błąd podczas wysyłania do Gladia: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
  }
}

/**
 * Complete client-side audio extraction and transcription
 */
export async function extractAndTranscribeClientSide(
  youtubeId: string,
  options: ClientAudioExtractionOptions & { language?: string; diarization?: boolean } = {}
): Promise<string> {
  const { language = 'pl', diarization = false, onProgress } = options;
  
  console.log(`🎯 Starting complete client-side workflow for ${youtubeId}`);
  
  try {
    // Step 1: Extract audio
    const audioResult = await extractAudioClientSide(youtubeId, { 
      ...options, 
      onProgress 
    });
    
    // Step 2: Upload to Gladia
    onProgress?.('Rozpoczynanie transkrypcji...');
    const transcript = await uploadAudioToGladia(
      audioResult.audioBlob, 
      { language, diarization },
      onProgress
    );
    
    console.log(`✅ Complete client-side workflow finished: ${transcript.length} characters`);
    onProgress?.('Transkrypcja ukończona!');
    
    return transcript;
    
  } catch (error) {
    console.error('❌ Complete client-side workflow failed:', error);
    throw error;
  }
}