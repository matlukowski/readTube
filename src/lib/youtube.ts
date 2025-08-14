import axios from 'axios';
import { VideoData } from './validations';

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

      const videoIds = response.data.items.map((item: any) => item.id.videoId).join(',');
      
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
        detailsResponse.data.items.map((item: any) => [item.id, item])
      );

      const enrichedItems = response.data.items.map((item: any) => {
        const details = detailsMap.get(item.id.videoId) as any;
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
      console.error('YouTube API search error:', error);
      throw new Error('Failed to search YouTube videos');
    }
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

  formatViewCount(count: string): string {
    const num = parseInt(count);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M views`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K views`;
    }
    return `${num} views`;
  }

  mapToVideoData(video: YouTubeVideo): VideoData {
    return {
      youtubeId: video.id.videoId || (video as any).id,
      title: video.snippet.title,
      channelName: video.snippet.channelTitle,
      channelId: video.snippet.channelId,
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
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