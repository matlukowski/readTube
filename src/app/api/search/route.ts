import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getYouTubeAPI } from '@/lib/youtube';
import { searchQuerySchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = searchQuerySchema.parse(body);

    const youtube = getYouTubeAPI();
    
    // Map filters to YouTube API parameters
    const searchParams = {
      query: validatedData.query,
      maxResults: validatedData.maxResults,
      pageToken: validatedData.pageToken,
      order: validatedData.filters?.sortBy,
      videoDuration: validatedData.filters?.duration,
      publishedAfter: getPublishedAfterDate(validatedData.filters?.uploadDate),
    };

    const searchResults = await youtube.search(searchParams);
    
    // Map results to our format
    const formattedResults = searchResults.items.map(item => 
      youtube.mapToVideoData(item)
    );

    // Save search to database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (user) {
      await prisma.search.create({
        data: {
          userId: user.id,
          query: validatedData.query,
          results: formattedResults,
        },
      });
    }

    return NextResponse.json({
      results: formattedResults,
      nextPageToken: searchResults.nextPageToken,
      totalResults: searchResults.pageInfo.totalResults,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search videos' },
      { status: 500 }
    );
  }
}

function getPublishedAfterDate(uploadDate?: string): string | undefined {
  if (!uploadDate) return undefined;

  const now = new Date();
  switch (uploadDate) {
    case 'today':
      now.setDate(now.getDate() - 1);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now.toISOString();
}