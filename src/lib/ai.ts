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
      Napisz BARDZO OBSZERNE I SZCZEGÓŁOWE podsumowanie jako osobistą refleksję w pierwszej osobie, jakby to były Twoje własne myśli.
      KLUCZOWE ZASADY:
      1. Zachowaj naturalny, konwersacyjny ton i poziom formalności z transkryptu
      2. Używaj bezpośrednio pierwszej osoby - nie pisz "autor twierdzi" tylko "myślę że" / "uważam" / "moim zdaniem"
      3. UWZGLĘDNIJ WSZYSTKIE KONKRETNE PRZYKŁADY, historie osobiste, anegdoty, liczby, fakty
      4. Używaj podobnych wyrażeń i stylu komunikacji jak w oryginalnej treści
      5. Przedstaw PEŁNY KONTEKST każdej rady czy spostrzeżenia
      6. MINIMALNA DŁUGOŚĆ: 2000-3000 słów - to ma być wyczerpujące podsumowanie
      7. Dziel na logiczne sekcje/akapity ale zachowaj płynność
      8. Nie skracaj - im więcej szczegółów tym lepiej
    ` : `
      Write a VERY COMPREHENSIVE AND DETAILED summary as a personal reflection in first person, as if these were your own thoughts.
      KEY PRINCIPLES:
      1. Maintain the natural, conversational tone and formality level from the transcript
      2. Use direct first person - don't write "the author claims" but "I think" / "I believe" / "in my opinion"
      3. INCLUDE ALL SPECIFIC EXAMPLES, personal stories, anecdotes, numbers, facts
      4. Use similar expressions and communication style as in the original content
      5. Present FULL CONTEXT for each piece of advice or insight
      6. MINIMUM LENGTH: 2000-3000 words - this should be a comprehensive summary
      7. Break into logical sections/paragraphs but maintain flow
      8. Don't shorten - the more details the better
    `;

    switch (style) {
      case 'bullet-points':
        return `${baseInstructions}
                ${language === 'pl' ? 'Stwórz bardzo szczegółowe podsumowanie używając rozbudowanych punktów. Każdy punkt powinien zawierać konkretne przykłady, historie i pełny kontekst. Używaj osobistego tonu i utrzymuj naturalny styl komunikacji.' : 'Create a very detailed summary using comprehensive bullet points. Each point should contain specific examples, stories and full context. Use personal tone and maintain natural communication style.'}`;
      
      case 'paragraph':
        return `${baseInstructions}
                ${language === 'pl' ? 'Napisz bardzo obszerne, płynne podsumowanie w formie rozbudowanych paragrafów. Uwzględnij wszystkie ważne historie, przykłady, rady i szczegóły. Używaj płynnych przejść ale zachowaj wszystkie konkretne informacje. Ma to być jak osobista, szczegółowa refleksja.' : 'Write a very comprehensive, flowing summary in the form of extended paragraphs. Include all important stories, examples, advice and details. Use smooth transitions but keep all concrete information. This should be like a personal, detailed reflection.'}`;
      
      case 'key-insights':
        return `${baseInstructions}
                ${language === 'pl' ? 'Skup się na najcenniejszych spostrzeżeniach ale przedstaw je BARDZO SZCZEGÓŁOWO z pełnym kontekstem, przykładami i historiami. Każde spostrzeżenie powinno być rozwinięte w kilka zdań z konkretnymi szczegółami.' : 'Focus on the most valuable insights but present them VERY THOROUGHLY with full context, examples and stories. Each insight should be expanded into several sentences with concrete details.'}`;
      
      default:
        return `${baseInstructions} ${language === 'pl' ? 'Podsumuj treść jako bardzo obszerną osobistą refleksję w pierwszej osobie, utrzymując naturalny styl komunikacji i wszystkie szczegóły.' : 'Summarize the content as a very comprehensive personal reflection in first person, maintaining natural communication style and all details.'}`;
    }
  }

  private getUserPrompt(transcript: string, options: SummarizationOptions): string {
    // Use much longer transcript for detailed summaries - up to 50k characters
    const truncatedTranscript = transcript.length > 50000 
      ? transcript.substring(0, 50000) + '...' 
      : transcript;

    const isPolish = options.language === 'pl';
    
    return isPolish ? 
      `Przeanalizuj poniższy transkrypt i napisz BARDZO OBSZERNE podsumowanie w pierwszej osobie.
      
      WYMAGANIA:
      - MINIMALNA długość: ${options.maxLength} słów (im więcej tym lepiej!)
      - Styl: ${options.style}
      - Zachowaj DOKŁADNIE oryginalny styl, zwroty i sposób mówienia autora
      - Uwzględnij WSZYSTKIE przykłady, historie, liczby, fakty
      - Nie skracaj - to ma być wyczerpujące podsumowanie
      - Używaj pierwszej osoby jakby to były Twoje myśli
      
      Transkrypt do przetworzenia:
      ${truncatedTranscript}` :
      `Analyze the following transcript and write a VERY COMPREHENSIVE summary in first person.
      
      REQUIREMENTS:
      - MINIMUM length: ${options.maxLength} words (the more the better!)
      - Style: ${options.style}
      - Preserve EXACTLY the original style, phrases and way of speaking
      - Include ALL examples, stories, numbers, facts
      - Don't shorten - this should be a comprehensive summary
      - Use first person as if these were your thoughts
      
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