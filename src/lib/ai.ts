import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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
      const systemPrompt = this.getSystemPrompt(options.style, options.language);
      const userPrompt = this.getUserPrompt(transcript, options);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
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

  // Removed extractKeyTopics and generateQuestions methods as they are no longer needed

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

  private getSystemPrompt(style: SummarizationOptions['style'], language: string = 'pl'): string {
    const baseInstructions = language === 'pl' ? `
      Napisz SKRÓCONE podsumowanie w pierwszej osobie, jakby to były Twoje własne myśli i doświadczenia.
      KLUCZOWE ZASADY:
      1. Używaj pierwszej osoby - "myślę", "uważam", "w mojej praktyce", "nauczyłem się"
      2. Skróć wypowiedź o około 50% zachowując pełny sens i wszystkie kluczowe informacje
      3. Uwzględnij WSZYSTKIE przykłady, liczby, fakty - ale w skondensowanej formie
      4. Utrzymaj naturalny, konwersacyjny ton autora
      5. Długość: około 50% oryginalnej wypowiedzi
      6. To ma być skrócona wersja dokładnie tych samych przemyśleń
      7. Zachowaj logiczny przepływ i strukturę oryginalnej wypowiedzi
      8. Nie pomijaj ważnych treści - tylko skracaj ich przedstawienie
    ` : `
      Write a CONDENSED summary in first person, as if these were your own thoughts and experiences.
      KEY PRINCIPLES:
      1. Use first person - "I think", "I believe", "in my practice", "I learned"
      2. Shorten the speech by about 50% while keeping full meaning and all key information
      3. Include ALL examples, numbers, facts - but in condensed form
      4. Maintain the author's natural, conversational tone
      5. Length: about 50% of the original speech
      6. This should be a shortened version of exactly the same thoughts
      7. Preserve logical flow and structure of original speech
      8. Don't skip important content - just shorten its presentation
    `;

    switch (style) {
      case 'bullet-points':
        return `${baseInstructions}
                ${language === 'pl' ? 'Przedstaw jako skrócone punkty w pierwszej osobie. Każdy punkt to skondensowana wersja moich myśli - około 50% krócej ale z zachowaniem wszystkich ważnych informacji.' : 'Present as condensed bullet points in first person. Each point is a condensed version of my thoughts - about 50% shorter but keeping all important information.'}`;
      
      case 'paragraph':
        return `${baseInstructions}
                ${language === 'pl' ? 'Napisz skrócone podsumowanie w formie płynnych paragrafów w pierwszej osobie. Każda sekcja to skondensowana wersja moich oryginalnych przemyśleń - około 50% krócej.' : 'Write a condensed summary in flowing paragraphs in first person. Each section is a condensed version of my original thoughts - about 50% shorter.'}`;
      
      case 'key-insights':
        return `${baseInstructions}
                ${language === 'pl' ? 'Przedstaw najważniejsze wnioski jako skrócone refleksje w pierwszej osobie. Każde spostrzeżenie to skondensowana wersja mojego myślenia - około 50% krócej ale z kluczowymi przykładami.' : 'Present key insights as condensed reflections in first person. Each insight is a condensed version of my thinking - about 50% shorter but with key examples.'}`;
      
      default:
        return `${baseInstructions} ${language === 'pl' ? 'Podsumuj treść jako skróconą wersję w pierwszej osobie - około 50% krócej, zachowując wszystkie istotne informacje.' : 'Summarize the content as a condensed version in first person - about 50% shorter, preserving all essential information.'}`;
    }
  }

  private getUserPrompt(transcript: string, options: SummarizationOptions): string {
    // Use much longer transcript for detailed summaries - up to 50k characters
    const truncatedTranscript = transcript.length > 50000 
      ? transcript.substring(0, 50000) + '...' 
      : transcript;

    const isPolish = options.language === 'pl';
    
    return isPolish ? 
      `Przeanalizuj poniższy transkrypt i napisz SKRÓCONE podsumowanie w pierwszej osobie.
      
      WYMAGANIA:
      - Długość: około ${options.maxLength} słów (około 50% długości oryginału)
      - Styl: ${options.style}
      - Pierwsza osoba - jakby to były Twoje własne myśli
      - Skróć wszystkie wypowiedzi o około 50% zachowując pełny sens
      - Uwzględnij WSZYSTKIE kluczowe informacje w skondensowanej formie
      - Zachowaj naturalny, konwersacyjny ton oryginału
      - To ma być skrócona wersja dokładnie tych samych przemyśleń
      
      Transkrypt do przetworzenia:
      ${truncatedTranscript}` :
      `Analyze the following transcript and write a CONDENSED summary in first person.
      
      REQUIREMENTS:
      - Length: approximately ${options.maxLength} words (about 50% of original length)
      - Style: ${options.style}
      - First person - as if these were your own thoughts
      - Shorten all statements by about 50% while keeping full meaning
      - Include ALL key information in condensed form
      - Maintain natural, conversational tone of the original
      - This should be a shortened version of exactly the same thoughts
      
      Transcript to process:
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