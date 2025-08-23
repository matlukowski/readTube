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
        temperature: 1.0, // Default value required by gpt-5-nano
      });

      return response.choices[0]?.message?.content?.trim() || 'Failed to generate summary';
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
      Tworzysz zwięzłe, ale angażujące podsumowania filmów z YouTube. Pisz jak doświadczony dziennikarz, który potrafi przekazać główne treści w przystępny sposób.

      STYL PISANIA:
      1. Pisz naturalnie, jakbyś opowiadał znajomemu o ciekawym filmie
      2. Unikaj sztywnych, powtarzających się zwrotów jak "omawiane jest", "przedstawiane jest", "film opisuje"
      3. Każdy akapit zacznij inaczej - używaj nazwy tematu, ciekawego faktu, pytania lub bezpośrednio głównej informacji
      4. Preferuj stronę czynną zamiast biernej ("Autor pokazuje" zamiast "pokazywane jest")
      5. Łącz zdania płynnymi przejściami, unikaj mechanicznego wyliczania

      STRUKTURA:
      1. Zacznij od najbardziej intrygującego aspektu z filmu
      2. Przedstaw główne tezy/punkty w logicznej kolejności
      3. Zakończ kluczowymi wnioskami lub praktycznymi informacjami

      PRZYKŁADY DOBRYCH POCZĄTKÓW:
      - "[Nazwa tematu] to..."
      - "Główną tezą filmu jest..."
      - "[Konkretny fakt/liczba] pokazuje..."
      - "Według autora..."

      DŁUGOŚĆ: około 500-800 słów
      CEL: Sprawić, żeby czytelnik zrozumiał o czym był film, nawet go nie oglądając.
    ` : `
      You create concise but engaging YouTube video summaries. Write like an experienced journalist who can convey main content in an accessible way.

      WRITING STYLE:
      1. Write naturally, as if telling a friend about an interesting video
      2. Avoid stiff, repetitive phrases like "it is discussed", "it is presented", "the video describes"
      3. Start each paragraph differently - use topic names, interesting facts, questions, or direct main information
      4. Prefer active voice over passive ("The author shows" instead of "it is shown")
      5. Connect sentences with smooth transitions, avoid mechanical listing

      STRUCTURE:
      1. Start with the most intriguing aspect from the video
      2. Present main theses/points in logical order
      3. End with key conclusions or practical information

      EXAMPLES OF GOOD BEGINNINGS:
      - "[Topic name] is..."
      - "The main thesis of the video is..."
      - "[Specific fact/number] shows..."
      - "According to the author..."

      LENGTH: about 500-800 words
      GOAL: Make the reader understand what the video was about without watching it.
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
      `Przeanalizuj poniższy transkrypt i napisz ZWIĘZŁE ale KOMPLETNE podsumowanie w pierwszej osobie.
      
      KLUCZOWE WYMAGANIA ZWIĘZŁOŚCI:
      - Długość: MAKSYMALNIE ${options.maxLength} słów (to jest twardy limit!)
      - Styl: ${options.style}
      - Wybierz tylko 3-5 najważniejszych tematów z całej wypowiedzi
      - Każdy temat opisz w 2-3 zdaniach maksymalnie
      - Zachowaj konkretne przykłady i liczby, ale skróć je o 70%
      - Pomiń wszystkie powtórzenia, dygresje i wypełniacze
      - Skup się na praktycznych wnioskach i actionable insights
      - Pierwsza osoba - jakby to były Twoje myśli: "myślę", "uważam", "w mojej praktyce"
      - Maksymalna gęstość informacji - każde słowo musi być wartościowe
      
      PRZYKŁAD TRANSFORMACJI:
      Zamiast: "Chciałbym powiedzieć, że moim zdaniem, w kontekście tego co mówiłem wcześniej..."
      Pisz: "Uważam, że..."
      
      Transkrypt do przetworzenia:
      ${truncatedTranscript}` :
      `Analyze the following transcript and write a CONCISE but COMPLETE summary in first person.
      
      KEY CONCISENESS REQUIREMENTS:
      - Length: MAXIMUM ${options.maxLength} words (this is a hard limit!)
      - Style: ${options.style}
      - Choose only 3-5 most important topics from the entire speech
      - Describe each topic in 2-3 sentences maximum
      - Keep concrete examples and numbers, but shorten them by 70%
      - Skip all repetitions, digressions and fillers
      - Focus on practical conclusions and actionable insights
      - First person - as if these were your thoughts: "I think", "I believe", "in my practice"
      - Maximum information density - every word must be valuable
      
      TRANSFORMATION EXAMPLE:
      Instead of: "I would like to say that in my opinion, in the context of what I mentioned earlier..."
      Write: "I believe that..."
      
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