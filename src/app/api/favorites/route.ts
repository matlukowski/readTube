import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { favoriteRequestSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        favorites: {
          include: {
            video: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ favorites: [] });
    }

    const favorites = user.favorites.map((fav: any) => ({
      id: fav.id,
      videoId: fav.videoId,
      video: fav.video,
      addedAt: fav.createdAt,
    }));

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('Get favorites error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, action } = favoriteRequestSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (action === 'add') {
      // Check if video exists, if not create it
      const video = await prisma.video.findUnique({
        where: { id: videoId },
      });

      if (!video) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      // Create favorite
      const favorite = await prisma.favorite.create({
        data: {
          userId: user.id,
          videoId: video.id,
        },
      });

      return NextResponse.json({ 
        message: 'Added to favorites',
        favorite 
      });
    } else if (action === 'remove') {
      // Remove favorite
      await prisma.favorite.deleteMany({
        where: {
          userId: user.id,
          videoId,
        },
      });

      return NextResponse.json({ 
        message: 'Removed from favorites' 
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Favorites API error:', error);
    return NextResponse.json(
      { error: 'Failed to update favorites' },
      { status: 500 }
    );
  }
}