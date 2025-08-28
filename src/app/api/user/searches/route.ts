import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await authenticateRequest(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        searches: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ searches: [], total: 0 });
    }

    const total = await prisma.search.count({
      where: { userId: user.id },
    });

    return NextResponse.json({
      searches: user.searches,
      total,
    });
  } catch (error) {
    console.error('Get user searches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}