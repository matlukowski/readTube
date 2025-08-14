import OpenAI from 'openai';

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
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: options.maxLength,
        temperature: 0.7,
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
        model: 'gpt-3.5-turbo',
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
        max_tokens: 200,
        temperature: 0.5,
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
        model: 'gpt-3.5-turbo',
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
        max_tokens: 300,
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content || '[]';
      return JSON.parse(content);
    } catch (error) {
      console.error('Question generation error:', error);
      return [];
    }
  }

  private getSystemPrompt(style: SummarizationOptions['style']): string {
    switch (style) {
      case 'bullet-points':
        return `You are a helpful assistant that creates concise, well-structured summaries of video transcripts. 
                Create a summary using bullet points. Each bullet point should capture a key idea or insight.
                Use clear, simple language and maintain the original meaning.`;
      
      case 'paragraph':
        return `You are a helpful assistant that creates clear, comprehensive summaries of video transcripts.
                Write a flowing paragraph summary that captures the main ideas and important details.
                Use clear transitions between ideas and maintain a logical structure.`;
      
      case 'key-insights':
        return `You are a helpful assistant that extracts the most valuable insights from video transcripts.
                Focus on actionable takeaways, surprising facts, and important lessons.
                Present each insight clearly with brief context.`;
      
      default:
        return 'Summarize the following video transcript clearly and concisely.';
    }
  }

  private getUserPrompt(transcript: string, options: SummarizationOptions): string {
    const truncatedTranscript = transcript.length > 10000 
      ? transcript.substring(0, 10000) + '...' 
      : transcript;

    return `Please summarize the following video transcript. 
            Maximum length: ${options.maxLength} words.
            Style: ${options.style}
            
            Transcript:
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