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

interface GladiaConfig {
  language?: string;
  diarization?: boolean;
  code_switching?: boolean;
  custom_vocabulary?: string[];
}

export class GladiaClient {
  private apiKey: string;
  private baseUrl = 'https://api.gladia.io/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Upload audio for transcription
   */
  async uploadAudio(audioStream: ReadableStream | Buffer, config?: GladiaConfig): Promise<GladiaUploadResponse> {
    try {
      console.log('🎵 Uploading audio to Gladia API...');

      const formData = new FormData();
      
      // Convert stream/buffer to blob for FormData
      let audioBlob: Blob;
      if (audioStream instanceof Buffer) {
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(audioStream);
        audioBlob = new Blob([uint8Array], { type: 'audio/mpeg' });
      } else if (audioStream instanceof ReadableStream) {
        // Handle ReadableStream
        const reader = audioStream.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        audioBlob = new Blob([buffer], { type: 'audio/mpeg' });
      } else {
        throw new Error('Unsupported audio stream type');
      }

      formData.append('audio', audioBlob, 'audio.mp3');
      
      // Add configuration
      const transcriptionConfig = {
        language: config?.language || 'auto',
        diarization: config?.diarization || false,
        code_switching: config?.code_switching || true,
        custom_vocabulary: config?.custom_vocabulary || [],
        output_format: 'json'
      };
      
      formData.append('config', JSON.stringify(transcriptionConfig));

      const response = await fetch(`${this.baseUrl}/pre-recorded`, {
        method: 'POST',
        headers: {
          'x-gladia-key': this.apiKey,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Gladia upload failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Audio uploaded to Gladia, transcription ID:', result.id);
      
      return result;
    } catch (error) {
      console.error('❌ Gladia upload failed:', error);
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
  
  if (!apiKey) {
    throw new Error('GLADIA_API_KEY environment variable is not set');
  }
  
  return new GladiaClient(apiKey);
}