// Gladia API client for audio transcription
// Used as fallback when YouTube captions are not available

interface GladiaTranscriptionResponse {
  id: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  result?: {
    transcription?: {
      full_transcript?: string;
      utterances?: Array<{
        start: number;
        end: number;
        text: string;
        speaker?: string;
      }>;
    };
  };
  error?: string;
}

interface GladiaUploadResponse {
  transcription_url: string;
  id: string;
}

interface GladiaFileUploadResponse {
  audio_url: string;
  audio_metadata: {
    id: string;
    filename: string;
    extension: string;
    size: number;
    audio_duration: number;
    number_of_channels: number;
  };
}

interface GladiaConfig {
  language?: string;
  diarization?: boolean;
  custom_vocabulary?: string[];
}

export class GladiaClient {
  private apiKey: string;
  private baseUrl = 'https://api.gladia.io/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Upload audio file to Gladia using multipart/form-data
   */
  async uploadFile(audioBuffer: Buffer): Promise<GladiaFileUploadResponse> {
    try {
      console.log('📤 Uploading audio file to Gladia /v2/upload...');
      console.log(`🔧 Debug: Buffer size: ${audioBuffer.length} bytes`);
      
      // Create FormData for multipart upload
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
      formData.append('audio', audioBlob, 'audio.mp3');
      
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'x-gladia-key': this.apiKey,
        },
        body: formData
      });

      console.log(`🔧 Debug: Upload response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`❌ File upload failed: ${response.status} - ${errorData}`);
        throw new Error(`File upload failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded successfully, audio_url:', result.audio_url);
      
      return result;
    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload audio for transcription using new v2 workflow
   */
  async uploadAudio(audioStream: ReadableStream | Buffer, config?: GladiaConfig): Promise<GladiaUploadResponse> {
    try {
      console.log('🎵 Starting Gladia v2 workflow...');
      console.log(`🔧 Debug: Audio stream type: ${audioStream instanceof Buffer ? 'Buffer' : audioStream instanceof ReadableStream ? 'ReadableStream' : 'Unknown'}`);
      
      // Step 1: Convert audio to Buffer first
      let audioBuffer: Buffer;
      if (audioStream instanceof Buffer) {
        audioBuffer = audioStream;
        console.log(`🔧 Debug: Buffer size: ${audioBuffer.length} bytes`);
      } else if (audioStream instanceof ReadableStream) {
        // Convert ReadableStream to Buffer
        const reader = audioStream.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        audioBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
        console.log(`🔧 Debug: Converted stream to buffer: ${audioBuffer.length} bytes`);
      } else {
        throw new Error('Unsupported audio stream type');
      }

      // Step 2: Upload file to get audio_url
      console.log('📤 Step 2: Uploading file to Gladia...');
      const uploadResult = await this.uploadFile(audioBuffer);
      console.log(`✅ File uploaded, audio_url: ${uploadResult.audio_url}`);

      // Step 3: Request transcription using audio_url
      console.log('🚀 Step 3: Starting transcription...');
      const payload = {
        audio_url: uploadResult.audio_url,
        language: config?.language || 'auto',
        diarization: config?.diarization || false,
        custom_vocabulary: config?.custom_vocabulary || []
      };

      console.log(`🔧 Debug: Making POST request to ${this.baseUrl}/pre-recorded`);
      console.log(`🔧 Debug: Transcription config: ${JSON.stringify({
        language: payload.language,
        diarization: payload.diarization,
        has_audio_url: !!payload.audio_url
      })}`);
      
      const response = await fetch(`${this.baseUrl}/pre-recorded`, {
        method: 'POST',
        headers: {
          'x-gladia-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log(`🔧 Debug: Transcription response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`❌ Transcription request failed: ${response.status} - ${errorData}`);
        throw new Error(`Transcription request failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Transcription started, ID:', result.id);
      console.log(`🔧 Debug: Transcription result: ${JSON.stringify(result)}`);
      
      return result;
    } catch (error) {
      console.error('❌ Gladia v2 workflow failed:', error);
      throw error;
    }
  }

  /**
   * Check transcription status
   */
  async getTranscriptionStatus(transcriptionId: string): Promise<GladiaTranscriptionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/transcription/${transcriptionId}`, {
        method: 'GET',
        headers: {
          'x-gladia-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gladia status check failed: ${response.status} - ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Gladia status check failed:', error);
      throw error;
    }
  }

  /**
   * Poll for transcription completion with timeout
   */
  async waitForTranscription(transcriptionId: string, maxWaitTime: number = 300000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds
    
    console.log(`⏳ Polling Gladia transcription ${transcriptionId}...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getTranscriptionStatus(transcriptionId);
        
        console.log(`📊 Transcription status: ${status.status}`);
        
        if (status.status === 'done' && status.result?.transcription?.full_transcript) {
          const transcript = status.result.transcription.full_transcript;
          console.log(`✅ Transcription completed: ${transcript.length} characters`);
          return transcript;
        }
        
        if (status.status === 'error') {
          throw new Error(`Transcription failed: ${status.error || 'Unknown error'}`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('❌ Error polling transcription:', error);
        throw error;
      }
    }
    
    throw new Error('Transcription timeout - process took too long');
  }

  /**
   * Complete transcription workflow: upload + wait for result
   */
  async transcribeAudio(
    audioStream: ReadableStream | Buffer, 
    config?: GladiaConfig,
    maxWaitTime?: number
  ): Promise<string> {
    try {
      console.log('🚀 Starting complete Gladia transcription workflow...');
      
      // Upload audio
      const uploadResult = await this.uploadAudio(audioStream, config);
      
      // Wait for transcription
      const transcript = await this.waitForTranscription(uploadResult.id, maxWaitTime);
      
      console.log('🎉 Gladia transcription completed successfully');
      return transcript;
      
    } catch (error) {
      console.error('❌ Complete Gladia transcription failed:', error);
      throw error;
    }
  }
}

// Export configured instance
export function createGladiaClient(): GladiaClient {
  const apiKey = process.env.GLADIA_API_KEY;
  
  console.log(`🔧 Debug: Creating Gladia client...`);
  console.log(`🔧 Debug: GLADIA_API_KEY present: ${!!apiKey}`);
  if (apiKey) {
    console.log(`🔧 Debug: API key starts with: ${apiKey.substring(0, 8)}...`);
  }
  
  if (!apiKey) {
    console.error(`❌ GLADIA_API_KEY environment variable is not set`);
    throw new Error('GLADIA_API_KEY environment variable is not set');
  }
  
  console.log(`✅ Gladia client created successfully`);
  return new GladiaClient(apiKey);
}