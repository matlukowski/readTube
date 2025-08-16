import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getYouTubeAPI } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { youtubeId } = await request.json();

    if (!youtubeId) {
      return NextResponse.json({ error: 'YouTube ID is required' }, { status: 400 });
    }

    // Validate YouTube ID format
    const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (!youtubeIdRegex.test(youtubeId)) {
      return NextResponse.json({ error: 'Invalid YouTube ID format' }, { status: 400 });
    }

    console.log(`🎬 Fetching video details for: ${youtubeId}`);

    try {
      const youtubeAPI = getYouTubeAPI();
      const videoData = await youtubeAPI.getVideoDetails(youtubeId);

      // Map to our expected format
      const videoDetails = youtubeAPI.mapToVideoData(videoData);

      console.log(`✅ Video details fetched successfully for: ${youtubeId}`);
      console.log(`📹 Title: ${videoDetails.title}`);
      console.log(`👤 Channel: ${videoDetails.channelName}`);

      return NextResponse.json({
        youtubeId: videoDetails.youtubeId,
        title: videoDetails.title,
        channelName: videoDetails.channelName,
        thumbnail: videoDetails.thumbnail,
        duration: videoDetails.duration,
        viewCount: videoDetails.viewCount,
        publishedAt: videoDetails.publishedAt,
        description: videoDetails.description,
      });

    } catch (youtubeError) {
      console.error('❌ YouTube API error:', youtubeError);
      
      // Handle specific YouTube API errors
      if (youtubeError instanceof Error) {
        if (youtubeError.message.includes('quota')) {
          return NextResponse.json(
            { error: 'YouTube API quota exceeded. Please try again later.' },
            { status: 429 }
          );
        }
        if (youtubeError.message.includes('not found') || youtubeError.message.includes('Video not found')) {
          return NextResponse.json(
            { error: 'Video not found. Please check the YouTube URL.' },
            { status: 404 }
          );
        }
        if (youtubeError.message.includes('private') || youtubeError.message.includes('Private')) {
          return NextResponse.json(
            { error: 'Cannot access private videos.' },
            { status: 403 }
          );
        }
        if (youtubeError.message.includes('unavailable') || youtubeError.message.includes('deleted')) {
          return NextResponse.json(
            { error: 'Video is unavailable or has been deleted.' },
            { status: 410 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch video details. Please check the URL and try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Video details API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}