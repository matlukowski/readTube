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

  const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  
  try {
    // Step 1: Use Cobalt API to get audio URL
    onProgress?.('Łączenie z serwisem pobierania...');
    console.log('🔗 Step 1: Getting audio URL from Cobalt API...');
    
    const cobaltResponse = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        filenamePattern: 'classic',
        isAudioOnly: true,
      })
    });

    if (!cobaltResponse.ok) {
      throw new Error(`Cobalt API failed: ${cobaltResponse.status}`);
    }

    const cobaltData = await cobaltResponse.json();
    
    if (cobaltData.status !== 'success' || !cobaltData.url) {
      throw new Error('Nie można pobrać audio URL z serwisu');
    }

    console.log('✅ Got audio URL from Cobalt API');
    
    // Step 2: Download audio file
    onProgress?.('Pobieranie pliku audio...');
    console.log('⬇️ Step 2: Downloading audio file...');
    
    const audioResponse = await fetch(cobaltData.url);
    
    if (!audioResponse.ok) {
      throw new Error(`Audio download failed: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    const audioSize = audioBlob.size;
    
    console.log(`✅ Audio download complete: ${audioSize} bytes`);
    
    // Estimate duration (rough calculation)
    const estimatedDuration = Math.min(audioSize / 32000, maxDuration); // 32KB/s estimate
    
    if (audioSize > maxDuration * 32000) { // Rough size check
      throw new Error(`Film prawdopodobnie zbyt długi. Spróbuj z krótszym filmem.`);
    }

    const result: ClientAudioExtractionResult = {
      audioBlob,
      title: `YouTube Video ${youtubeId}`, // We don't have title from Cobalt
      duration: estimatedDuration,
      size: audioSize
    };
    
    console.log(`🎉 Client-side extraction complete: ${Math.round(audioSize/1024/1024)}MB`);
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

      if (error.message.includes('Cobalt API')) {
        throw new Error('Serwis pobierania jest niedostępny - spróbuj ponownie później');
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