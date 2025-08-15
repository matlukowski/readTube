import OpenAI from 'openai';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

export interface SummarizationOptions {
  style: 'bullet-points' | 'paragraph' | 'key-insights';
  maxLength: number;
  language?: string;
}

export class AIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
    });
  }

  async summarizeTranscript(
    transcript: string,
    options: SummarizationOptions
  ): Promise<string> {
    try {
      const systemPrompt = this.getSystemPrompt(options.style);
      const userPrompt = this.getUserPrompt(transcript, options);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 128000,
        temperature: 1,
      });

      return response.choices[0]?.message?.content || 'Failed to generate summary';
    } catch (error) {
      console.error('OpenAI summarization error:', error);
      throw new Error('Failed to summarize transcript');
    }
  }

  async extractKeyTopics(transcript: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract 5-10 key topics or concepts from the transcript. Return as a JSON array of strings.',
          },
          {
            role: 'user',
            content: `Extract key topics from this transcript: ${transcript.substring(0, 3000)}`,
          },
        ],
        max_completion_tokens: 128000,
        temperature: 1,
      });

      const content = response.choices[0]?.message?.content || '[]';
      return JSON.parse(content);
    } catch (error) {
      console.error('Topic extraction error:', error);
      return [];
    }
  }

  async generateQuestions(transcript: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate 3-5 thought-provoking questions based on the video content. Return as a JSON array of strings.',
          },
          {
            role: 'user',
            content: `Generate questions from this transcript: ${transcript.substring(0, 3000)}`,
          },
        ],
        max_completion_tokens: 128000,
        temperature: 1,
      });

      const content = response.choices[0]?.message?.content || '[]';
      return JSON.parse(content);
    } catch (error) {
      console.error('Question generation error:', error);
      return [];
    }
  }

  async downloadYouTubeAudio(youtubeId: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Check for existing audio files (any format)
    const existingFiles = fs.readdirSync(tempDir).filter((f: string) => f.startsWith(youtubeId));
    if (existingFiles.length > 0) {
      const existingPath = path.join(tempDir, existingFiles[0]);
      console.log(`🔄 Using existing audio file: ${existingPath}`);
      return existingPath;
    }

    try {
      const videoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      console.log(`🎵 Downloading audio from: ${videoUrl}`);
      
      // Use yt-dlp to download audio in MP3 format
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Download audio in webm format (no conversion needed)
      const command = `yt-dlp -f "bestaudio" -o "${tempDir}/%(id)s.%(ext)s" "${videoUrl}"`;
      console.log(`🛠️ Running command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      console.log(`📤 yt-dlp stdout:`, stdout);
      if (stderr) console.log(`📤 yt-dlp stderr:`, stderr);
      
      // Find the downloaded audio file
      const downloadedFiles = fs.readdirSync(tempDir).filter((f: string) => f.startsWith(youtubeId));
      if (downloadedFiles.length === 0) {
        throw new Error(`Audio file not created in ${tempDir}`);
      }
      
      const audioPath = path.join(tempDir, downloadedFiles[0]);
      const stats = fs.statSync(audioPath);
      console.log(`✅ Audio downloaded successfully: ${audioPath}. Size: ${stats.size} bytes`);
      
      return audioPath;
    } catch (error) {
      console.error('Audio download error:', error);
      throw new Error('Failed to download audio from YouTube');
    }
  }

  async transcribeWithWhisper(audioPath: string): Promise<string> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'text',
      });

      return transcription as string;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw new Error('Failed to transcribe audio with Whisper');
    }
  }

  async transcribeYouTubeVideo(youtubeId: string): Promise<string> {
    let audioPath: string | null = null;
    
    try {
      // Download audio from YouTube
      audioPath = await this.downloadYouTubeAudio(youtubeId);
      
      // Transcribe with Whisper
      const transcript = await this.transcribeWithWhisper(audioPath);
      
      return transcript;
    } catch (error) {
      console.error('YouTube transcription error:', error);
      throw error;
    } finally {
      // Cleanup temp file
      if (audioPath && fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
    }
  }

  private getSystemPrompt(style: SummarizationOptions['style']): string {
    const baseInstructions = `
      Napisz podsumowanie jako osobistą refleksję w pierwszej osobie, jakby to była Twoja własna opinia lub przemyślenia na dany temat.
      WAŻNE: Zachowaj oryginalny styl wypowiedzi autora - jego ton, sposób mówienia, charakterystyczne zwroty, poziom formalności, używany słownik.
      Nie pisz "Autor mówi..." ani "W filmie omawiane są...", tylko bezpośrednio przedstaw treść w pierwszej osobie.
      Przykład: zamiast "Autor uważa, że zmiany klimatu..." napisz "Jeśli chodzi o zmiany klimatu, to...".
    `;

    switch (style) {
      case 'bullet-points':
        return `${baseInstructions}
                Stwórz podsumowanie używając listy punktów. Każdy punkt powinien przedstawić kluczową myśl lub spostrzeżenie.
                Używaj jasnego języka i zachowaj oryginalny styl autora. Punkty mają brzmieć jak osobiste przemyślenia.`;
      
      case 'paragraph':
        return `${baseInstructions}
                Napisz płynne podsumowanie w formie paragrafu/paragrafów, które przedstawia główne idee i ważne szczegóły.
                Używaj płynnych przejść między pomysłami i zachowaj logiczną strukturę. Całość ma brzmieć jak osobista refleksja na temat.`;
      
      case 'key-insights':
        return `${baseInstructions}
                Skup się na najcenniejszych spostrzeżeniach - praktycznych wnioskach, zaskakujących faktach i ważnych lekcjach.
                Przedstaw każde spostrzeżenie jako osobistą refleksję z krótkim kontekstem.`;
      
      default:
        return `${baseInstructions} Podsumuj treść jako osobistą refleksję w pierwszej osobie, zachowując styl autora.`;
    }
  }

  private getUserPrompt(transcript: string, options: SummarizationOptions): string {
    const truncatedTranscript = transcript.length > 10000 
      ? transcript.substring(0, 10000) + '...' 
      : transcript;

    return `Przeanalizuj poniższy transkrypt i napisz podsumowanie w pierwszej osobie, jakby to były Twoje własne przemyślenia na ten temat.
            Maksymalna długość: ${options.maxLength} słów.
            Styl: ${options.style}
            Zachowaj oryginalny styl wypowiedzi, ton i charakterystyczne zwroty autora.
            
            Transkrypt do przetworzenia:
            ${truncatedTranscript}`;
  }
}

export const getAIService = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new AIService(apiKey);
};