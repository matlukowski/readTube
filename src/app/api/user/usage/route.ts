import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { formatMinutesToTime, getRemainingMinutes } from '@/lib/stripe';

// GET /api/user/usage - Get user's current usage and limits
export async function GET(request: NextRequest) {
  try {
    const { userId, user: authUser } = await authenticateRequest(request);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get recent usage logs (last 10 analyses)
    const recentUsage = await prisma.usageLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        youtubeId: true,
        videoTitle: true,
        videoDuration: true,
        minutesUsed: true,
        createdAt: true,
      },
    });

    // Get payment history
    const payments = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        minutesPurchased: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const remainingMinutes = getRemainingMinutes(user.minutesUsed, user.minutesPurchased);
    const hasUnlimitedAccess = remainingMinutes > 0;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionStatus: user.subscriptionStatus,
        lastPurchaseAt: user.lastPurchaseAt,
      },
      usage: {
        minutesUsed: user.minutesUsed,
        minutesPurchased: user.minutesPurchased,
        remainingMinutes,
        hasUnlimitedAccess,
        formattedUsed: formatMinutesToTime(user.minutesUsed),
        formattedPurchased: formatMinutesToTime(user.minutesPurchased),
        formattedRemaining: formatMinutesToTime(remainingMinutes),
      },
      recentUsage,
      payments,
      stats: {
        totalAnalyses: await prisma.usageLog.count({
          where: { userId: user.id },
        }),
        totalSpent: payments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0),
      },
    });
  } catch (error) {
    console.error('Usage API error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication failed')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}

// POST /api/user/usage - Log video analysis usage
export async function POST(request: NextRequest) {
  try {
    const { userId, user: authUser } = await authenticateRequest(request);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { youtubeId, videoTitle, videoDuration, minutesUsed } = await request.json();

    if (!youtubeId || !videoTitle || !videoDuration || minutesUsed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: youtubeId, videoTitle, videoDuration, minutesUsed' },
        { status: 400 }
      );
    }

    console.log(`📊 Logging usage for user ${user.id}: ${minutesUsed} minutes for video ${youtubeId}`);

    // Create usage log entry
    const usageLog = await prisma.usageLog.create({
      data: {
        userId: user.id,
        youtubeId,
        videoTitle,
        videoDuration,
        minutesUsed,
      },
    });

    // Update user's total minutes used
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        minutesUsed: {
          increment: minutesUsed,
        },
        updatedAt: new Date(),
      },
    });

    const remainingMinutes = getRemainingMinutes(updatedUser.minutesUsed, updatedUser.minutesPurchased);

    console.log(`✅ Usage logged. User now has ${remainingMinutes} minutes remaining`);

    return NextResponse.json({
      success: true,
      usageLog,
      usage: {
        minutesUsed: updatedUser.minutesUsed,
        minutesPurchased: updatedUser.minutesPurchased,
        remainingMinutes,
        hasUnlimitedAccess: remainingMinutes > 0,
      },
    });
  } catch (error) {
    console.error('Usage logging error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Authentication failed')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to log usage' },
      { status: 500 }
    );
  }
}