import { z } from 'zod';

export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200),
  filters: z.object({
    duration: z.enum(['short', 'medium', 'long']).optional(),
    uploadDate: z.enum(['today', 'week', 'month', 'year']).optional(),
    sortBy: z.enum(['relevance', 'date', 'viewCount']).optional(),
  }).optional(),
  maxResults: z.number().min(1).max(50).default(20),
  pageToken: z.string().optional(),
});

export const videoDataSchema = z.object({
  youtubeId: z.string(),
  title: z.string(),
  channelName: z.string(),
  channelId: z.string().optional(),
  thumbnail: z.string().url(),
  duration: z.string().optional(),
  viewCount: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  description: z.string().optional(),
});

export const transcribeRequestSchema = z.object({
  youtubeId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube video ID'),
  language: z.string().default('en'),
});

export const summarizeRequestSchema = z.object({
  transcript: z.string().min(100, 'Transcript too short to summarize'),
  maxLength: z.number().min(500).max(5000).default(2500),
  style: z.enum(['bullet-points', 'paragraph', 'key-insights']).default('paragraph'),
  language: z.enum(['pl', 'en']).default('pl'),
});

export const favoriteRequestSchema = z.object({
  videoId: z.string(),
  action: z.enum(['add', 'remove']),
});

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
  language: z.string().default('en'),
  defaultFilters: z.object({
    duration: z.enum(['short', 'medium', 'long']).optional(),
    sortBy: z.enum(['relevance', 'date', 'viewCount']).optional(),
  }).optional(),
  autoTranscribe: z.boolean().default(false),
  autoSummarize: z.boolean().default(false),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type VideoData = z.infer<typeof videoDataSchema>;
export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;
export type SummarizeRequest = z.infer<typeof summarizeRequestSchema>;
export type FavoriteRequest = z.infer<typeof favoriteRequestSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;