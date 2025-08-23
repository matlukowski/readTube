import axios from 'axios';
import { SearchResult } from '@/stores/searchStore';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface YouTubeSearchParams {
  query: string;
  maxResults?: number;
  pageToken?: string;
  order?: 'relevance' | 'date' | 'viewCount';
  videoDuration?: 'short' | 'medium' | 'long';
  publishedAfter?: string;
}

interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    channelId: string;
    thumbnails: {
      high: { url: string };
      medium: { url: string };
      default: { url: string };
    };
    publishedAt: string;
  };
  contentDetails?: {
    duration: string;
  };
  statistics?: {
    viewCount: string;
  };
}

export class YouTubeAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(params: YouTubeSearchParams): Promise<YouTubeSearchResponse> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
          params: {
            key: this.apiKey,
            part: 'snippet',
            type: 'video',
            q: params.query,
            maxResults: params.maxResults || 20,
            pageToken: params.pageToken,
            order: params.order || 'relevance',
            videoDuration: params.videoDuration,
            publishedAfter: params.publishedAfter,
          },
        });

        const videoIds = response.data.items.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');
        
        // Get additional details for videos
        const detailsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
          params: {
            key: this.apiKey,
            part: 'contentDetails,statistics',
            id: videoIds,
          },
        });

        // Merge the details with search results
        const detailsMap = new Map(
          detailsResponse.data.items.map((item: { id: string; [key: string]: unknown }) => [item.id, item])
        );

        const enrichedItems = response.data.items.map((item: { id: { videoId: string }; [key: string]: unknown }) => {
          const details = detailsMap.get(item.id.videoId) as { contentDetails?: unknown; statistics?: unknown; [key: string]: unknown } | undefined;
          return {
            ...item,
            contentDetails: details?.contentDetails,
            statistics: details?.statistics,
          };
        });

        return {
          ...response.data,
          items: enrichedItems,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check if this is a rate limit or quota error that we should retry
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorMessage = error.response?.data?.error?.message || '';
          
          if (status === 403) {
            // Quota exceeded or forbidden
            if (errorMessage.includes('quota')) {
              throw new Error('YouTube API quota exceeded. Please try again later.');
            } else if (errorMessage.includes('disabled')) {
              throw new Error('YouTube API access is disabled. Please check your API key.');
            } else {
              throw new Error('YouTube API access forbidden. Please check your API key and quota.');
            }
          } else if (status === 429) {
            // Rate limit exceeded - retry with exponential backoff
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
              console.log(`🔄 Rate limit hit. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw new Error('YouTube API rate limit exceeded. Please try again later.');
          } else if (status === 500 || status === 502 || status === 503) {
            // Server errors - retry
            if (attempt < maxRetries) {
              const delay = 1000 * attempt; // 1s, 2s, 3s
              console.log(`🔄 Server error. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw new Error('YouTube API is temporarily unavailable. Please try again later.');
          }
        }
        
        console.error(`YouTube API search error (attempt ${attempt}/${maxRetries}):`, error);
        
        // If this is not the last attempt, continue to retry
        if (attempt < maxRetries) {
          const delay = 1000 * attempt;
          console.log(`🔄 Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Last attempt failed
        throw new Error('Failed to search YouTube videos. Please try again later.');
      }
    }
    
    throw lastError!;
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideo> {
    try {
      const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
        params: {
          key: this.apiKey,
          part: 'snippet,contentDetails,statistics',
          id: videoId,
        },
      });

      if (response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      return response.data.items[0];
    } catch (error) {
      console.error('YouTube API get video error:', error);
      throw new Error('Failed to get video details');
    }
  }

  formatDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Convert ISO 8601 duration to minutes for usage tracking
  parseDurationToMinutes(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const seconds = match[3] ? parseInt(match[3]) : 0;

    // Convert everything to minutes, round up seconds
    const totalMinutes = hours * 60 + minutes + Math.ceil(seconds / 60);
    return totalMinutes;
  }

  // Convert formatted duration string (e.g., "1:23:45" or "23:45") to minutes
  static parseDurationStringToMinutes(durationString: string): number {
    if (!durationString) return 0;
    
    const parts = durationString.split(':').map(part => parseInt(part));
    
    if (parts.length === 3) {
      // Format: H:MM:SS
      const [hours, minutes, seconds] = parts;
      return hours * 60 + minutes + Math.ceil(seconds / 60);
    } else if (parts.length === 2) {
      // Format: MM:SS
      const [minutes, seconds] = parts;
      return minutes + Math.ceil(seconds / 60);
    }
    
    return 0;
  }

  formatViewCount(count: string): string {
    const num = parseInt(count);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M views`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K views`;
    }
    return `${num} views`;
  }

  mapToVideoData(video: YouTubeVideo): SearchResult {
    const youtubeId = video.id.videoId || (video as unknown as { id: string }).id;
    return {
      id: `yt_${youtubeId}`, // Generate unique ID for SearchResult
      youtubeId,
      title: video.snippet.title,
      channelName: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url || '',
      duration: video.contentDetails ? this.formatDuration(video.contentDetails.duration) : undefined,
      viewCount: video.statistics ? this.formatViewCount(video.statistics.viewCount) : undefined,
      publishedAt: video.snippet.publishedAt,
      description: video.snippet.description,
    };
  }
}

export const getYouTubeAPI = () => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }
  return new YouTubeAPI(apiKey);
};