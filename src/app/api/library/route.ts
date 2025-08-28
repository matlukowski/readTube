import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/library - Get user's saved video summaries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const youtubeIdParam = searchParams.get('youtubeId');
    const googleIdParam = searchParams.get('googleId');
    
    // Get current user using Google OAuth
    const user = await getCurrentUser(googleIdParam || undefined);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;

    // If specific youtubeId is requested, return that video
    if (youtubeIdParam) {
      console.log(`📚 Getting specific video: ${youtubeIdParam} for user ${userId}`);
      
      const video = await prisma.video.findFirst({
        where: {
          youtubeId: youtubeIdParam,
          userId: userId
        },
        select: {
          id: true,
          youtubeId: true,
          title: true,
          channelName: true,
          duration: true,
          viewCount: true,
          publishedAt: true,
          description: true,
          thumbnail: true,
          transcript: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!video) {
        return NextResponse.json({
          error: 'Film nie został znaleziony w bibliotece',
          videos: []
        }, { status: 404 });
      }

      return NextResponse.json({
        videos: [video],
        total: 1,
        youtubeId: youtubeIdParam
      });
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause = {
      userId: userId,
      AND: [
        { transcript: { not: null } }, // Only videos with transcripts (for chat functionality)
        search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { channelName: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } }
          ]
        } : {}
      ]
    };

    // Get total count for pagination
    const totalCount = await prisma.video.count({
      where: whereClause
    });

    // Get paginated results
    const videos = await prisma.video.findMany({
      where: whereClause,
      select: {
        id: true,
        youtubeId: true,
        title: true,
        channelName: true,
        thumbnail: true,
        duration: true,
        viewCount: true,
        publishedAt: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit
    });

    // Return videos as-is (no summary parsing needed)

    console.log(`📚 Library: Retrieved ${videos.length} videos for user ${userId}`);

    return NextResponse.json({
      videos: videos,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + videos.length < totalCount
      }
    });

  } catch (error) {
    console.error('Library GET API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch library' },
      { status: 500 }
    );
  }
}

// POST /api/library - Save a new video analysis to library
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { googleId } = body;
    
    // Get current user using Google OAuth
    const user = await getCurrentUser(googleId);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {
      youtubeId,
      title,
      channelName,
      thumbnail,
      duration,
      viewCount,
      publishedAt,
      description,
      transcript
    } = body;

    // Validate required fields
    if (!youtubeId || !title || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: youtubeId, title, transcript' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving video to library: ${youtubeId} - ${title}`);

    // Save or update video in library
    const savedVideo = await prisma.video.upsert({
      where: { youtubeId },
      update: {
        userId: user.id,
        title,
        channelName,
        thumbnail,
        duration,
        viewCount,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        description,
        transcript,
        updatedAt: new Date()
      },
      create: {
        youtubeId,
        userId: user.id,
        title,
        channelName,
        thumbnail: thumbnail || '',
        duration,
        viewCount,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        description,
        transcript
      },
      select: {
        id: true,
        youtubeId: true,
        title: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`✅ Video saved to library successfully: ${savedVideo.id}`);

    return NextResponse.json({
      success: true,
      video: savedVideo,
      message: 'Video saved to library successfully'
    });

  } catch (error) {
    console.error('Library POST API error:', error);
    
    // Handle duplicate key errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Video already exists in library' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save video to library' },
      { status: 500 }
    );
  }
}

// DELETE /api/library - Remove video from library
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const googleId = searchParams.get('googleId');
    
    // Get current user using Google OAuth
    const user = await getCurrentUser(googleId || undefined);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const youtubeId = searchParams.get('youtubeId');

    if (!youtubeId) {
      return NextResponse.json(
        { error: 'YouTube ID is required' },
        { status: 400 }
      );
    }

    // Delete video from user's library
    const deletedVideo = await prisma.video.deleteMany({
      where: {
        youtubeId,
        userId: user.id
      }
    });

    if (deletedVideo.count === 0) {
      return NextResponse.json(
        { error: 'Video not found in your library' },
        { status: 404 }
      );
    }

    console.log(`🗑️ Video removed from library: ${youtubeId}`);

    return NextResponse.json({
      success: true,
      message: 'Video removed from library successfully'
    });

  } catch (error) {
    console.error('Library DELETE API error:', error);
    return NextResponse.json(
      { error: 'Failed to remove video from library' },
      { status: 500 }
    );
  }
}