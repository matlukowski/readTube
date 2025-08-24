// Client do komunikacji z Python Transcript API
// Mikroserwis hostowany na Render.com

interface PythonTranscriptRequest {
  video_id: string;
  languages?: string[];
}

interface PythonTranscriptResponse {
  video_id: string;
  transcript: string;
  language: string;
  source: string;
  length: number;
}

interface PythonTranscriptError {
  detail: string;
}

export class PythonTranscriptClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.PYTHON_TRANSCRIPT_API_URL || 'http://localhost:8000';
    this.timeout = 30000; // 30 seconds timeout
    
    if (!process.env.PYTHON_TRANSCRIPT_API_URL) {
      console.warn('⚠️ PYTHON_TRANSCRIPT_API_URL not set, using localhost:8000');
    }
    
    console.log(`🔧 Python API URL: ${this.baseUrl}`);
  }

  /**
   * Health check - sprawdź czy Python API jest dostępne
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('🔍 Checking Python API health...');
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Python API health check passed:', data);
        return true;
      } else {
        console.warn('⚠️ Python API health check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Python API health check error:', error);
      return false;
    }
  }

  /**
   * Pobierz napisy z YouTube używając Python API
   * 
   * @param videoId - YouTube video ID
   * @param languages - Lista preferowanych języków (domyślnie ['pl', 'en'])
   * @returns Promise z napisami lub null jeśli nie udało się pobrać
   */
  async getTranscript(
    videoId: string, 
    languages: string[] = ['pl', 'en']
  ): Promise<string | null> {
    try {
      console.log(`🐍 Requesting transcript from Python API for ${videoId}`);
      console.log(`🔧 Preferred languages: ${languages.join(', ')}`);

      const requestBody: PythonTranscriptRequest = {
        video_id: videoId,
        languages
      };

      const response = await fetch(`${this.baseUrl}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        const data: PythonTranscriptResponse = await response.json();
        
        console.log(`✅ Python API success: ${data.length} chars in ${data.language}`);
        console.log(`📊 Source: ${data.source}`);
        console.log(`📝 Preview: ${data.transcript.substring(0, 100)}...`);
        
        return data.transcript;
      } else {
        // Handle different error status codes
        const errorData: PythonTranscriptError = await response.json();
        
        if (response.status === 404) {
          console.log(`⚠️ No transcripts available for ${videoId}: ${errorData.detail}`);
          return null; // Return null for missing transcripts (not an error)
        } else if (response.status >= 500) {
          console.error(`❌ Python API server error (${response.status}): ${errorData.detail}`);
          throw new Error(`Python API server error: ${errorData.detail}`);
        } else {
          console.error(`❌ Python API client error (${response.status}): ${errorData.detail}`);
          throw new Error(`Python API error: ${errorData.detail}`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          console.error(`⏰ Python API timeout for ${videoId}`);
          throw new Error('Python API request timed out');
        } else if (error.message.includes('fetch')) {
          console.error(`🔌 Network error connecting to Python API: ${error.message}`);
          throw new Error('Failed to connect to Python API');
        } else {
          // Re-throw known errors
          throw error;
        }
      } else {
        console.error(`❌ Unknown error calling Python API:`, error);
        throw new Error('Unknown error occurred while fetching transcript');
      }
    }
  }

  /**
   * Pobierz napisy z retry mechanizmem
   * 
   * @param videoId - YouTube video ID
   * @param languages - Lista preferowanych języków
   * @param maxRetries - Maksymalna liczba prób (domyślnie 2)
   * @returns Promise z napisami lub null
   */
  async getTranscriptWithRetry(
    videoId: string,
    languages: string[] = ['pl', 'en'],
    maxRetries: number = 2
  ): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`🔄 Python API attempt ${attempt}/${maxRetries + 1} for ${videoId}`);
        
        const result = await this.getTranscript(videoId, languages);
        
        if (result !== null) {
          return result;
        } else if (attempt === 1) {
          // If no transcript found on first try, don't retry
          console.log(`ℹ️ No transcript available for ${videoId}, not retrying`);
          return null;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`⚠️ Python API attempt ${attempt} failed:`, lastError.message);
        
        if (attempt <= maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`⏱️ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    throw lastError || new Error('All Python API attempts failed');
  }
}

// Export singleton instance
export const pythonTranscriptClient = new PythonTranscriptClient();