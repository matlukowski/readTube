import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser } from '@/lib/user';

// GET /api/library - Get user's saved video summaries
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause = {
      userId: user.id,
      AND: [
        { summary: { not: null } }, // Only videos with summaries
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
        summary: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit
    });

    // Parse summary JSON if it's stored as string
    const videosWithParsedSummary = videos.map(video => ({
      ...video,
      summary: typeof video.summary === 'string' 
        ? (() => {
            try {
              const parsed = JSON.parse(video.summary);
              return parsed.summary || video.summary;
            } catch {
              return video.summary;
            }
          })()
        : video.summary
    }));

    console.log(`📚 Library: Retrieved ${videos.length} videos for user ${user.id}`);

    return NextResponse.json({
      videos: videosWithParsedSummary,
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      youtubeId,
      title,
      channelName,
      thumbnail,
      duration,
      viewCount,
      publishedAt,
      description,
      transcript,
      summary
    } = body;

    // Validate required fields
    if (!youtubeId || !title || !summary) {
      return NextResponse.json(
        { error: 'Missing required fields: youtubeId, title, summary' },
        { status: 400 }
      );
    }

    console.log(`💾 Saving video to library: ${youtubeId} - ${title}`);

    // Create enriched summary object
    const enrichedSummary = {
      summary,
      generatedAt: new Date().toISOString(),
      language: 'pl',
      savedToLibrary: true
    };

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
        summary: JSON.stringify(enrichedSummary),
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
        transcript,
        summary: JSON.stringify(enrichedSummary)
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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
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