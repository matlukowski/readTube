import { prisma } from '@/lib/prisma';
import { getRemainingMinutes, isStripeEnabled } from '@/lib/stripe';
import { YouTubeAPI } from '@/lib/youtube';

export interface UsageCheckResult {
  canAnalyze: boolean;
  remainingMinutes: number;
  requiredMinutes?: number;
  message?: string;
  user?: {
    id: string;
    minutesUsed: number;
    minutesPurchased: number;
    subscriptionStatus: string;
  };
}

/**
 * Check if user can analyze a video based on their usage limits
 */
export async function checkUsageLimit(youtubeId: string, userId?: string): Promise<UsageCheckResult> {
  try {
    // If Stripe is not enabled, allow unlimited usage (demo mode)
    if (!isStripeEnabled()) {
      console.log('🎯 Demo mode: Stripe not configured, allowing unlimited usage');
      return {
        canAnalyze: true,
        remainingMinutes: 999999, // Unlimited in demo mode
        requiredMinutes: 0,
        message: 'Demo mode: unlimited usage available',
      };
    }

    // Get user from database (user should be provided from authenticated request)
    if (!userId) {
      return {
        canAnalyze: false,
        remainingMinutes: 0,
        message: 'Użytkownik nie został znaleziony',
      };
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        minutesUsed: true,
        minutesPurchased: true,
        subscriptionStatus: true,
      }
    });
    
    if (!user) {
      return {
        canAnalyze: false,
        remainingMinutes: 0,
        message: 'Użytkownik nie został znaleziony',
      };
    }

    // Get video duration from YouTube API
    const youtubeAPI = new YouTubeAPI(process.env.YOUTUBE_API_KEY!);
    const videoData = await youtubeAPI.getVideoDetails(youtubeId);
    const requiredMinutes = videoData.contentDetails?.duration ? youtubeAPI.parseDurationToMinutes(videoData.contentDetails.duration) : 0;

    console.log(`🔍 Usage check for user ${user.id}: needs ${requiredMinutes} minutes, used ${user.minutesUsed}/${user.minutesPurchased}`);

    const remainingMinutes = getRemainingMinutes(user.minutesUsed, user.minutesPurchased);
    const canAnalyze = remainingMinutes >= requiredMinutes;

    if (!canAnalyze) {
      const message = remainingMinutes === 0 
        ? 'Wykorzystałeś już wszystkie dostępne minuty. Wykup pakiet 5 godzin za 25 zł, aby kontynuować analizy.'
        : `Ten film trwa ${requiredMinutes} minut, ale masz tylko ${remainingMinutes} minut pozostało. Wykup dodatkowy pakiet, aby przeanalizować dłuższe filmy.`;
      
      return {
        canAnalyze: false,
        remainingMinutes,
        requiredMinutes,
        message,
        user: {
          id: user.id,
          minutesUsed: user.minutesUsed,
          minutesPurchased: user.minutesPurchased,
          subscriptionStatus: user.subscriptionStatus,
        },
      };
    }

    return {
      canAnalyze: true,
      remainingMinutes,
      requiredMinutes,
      message: `Film można przeanalizować. Wykorzysta ${requiredMinutes} minut z ${remainingMinutes} dostępnych.`,
      user: {
        id: user.id,
        minutesUsed: user.minutesUsed,
        minutesPurchased: user.minutesPurchased,
        subscriptionStatus: user.subscriptionStatus,
      },
    };
  } catch (error) {
    console.error('Usage check error:', error);
    return {
      canAnalyze: false,
      remainingMinutes: 0,
      message: 'Błąd podczas sprawdzania limitów. Spróbuj ponownie.',
    };
  }
}

/**
 * Log video analysis usage after successful transcription
 */
export async function logVideoUsage({
  youtubeId,
  videoTitle,
  videoDuration,
  minutesUsed,
  userId
}: {
  youtubeId: string;
  videoTitle: string;
  videoDuration: string;
  minutesUsed: number;
  userId: string;
}): Promise<boolean> {
  try {
    // If Stripe is not enabled, skip usage logging (demo mode)
    if (!isStripeEnabled()) {
      console.log(`🎯 Demo mode: Skipping usage logging for "${videoTitle}"`);
      return true; // Return success but don't actually log
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.error('❌ Cannot log usage: user not found');
      return false;
    }

    console.log(`📝 Logging usage for user ${user.id}: ${minutesUsed} minutes for "${videoTitle}"`);

    // Create usage log entry
    await prisma.usageLog.create({
      data: {
        userId: user.id,
        youtubeId,
        videoTitle,
        videoDuration,
        minutesUsed,
      },
    });

    // Update user's total minutes used
    await prisma.user.update({
      where: { id: user.id },
      data: {
        minutesUsed: {
          increment: minutesUsed,
        },
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Usage logged successfully. User ${user.id} now has used ${user.minutesUsed + minutesUsed} minutes total.`);
    return true;
  } catch (error) {
    console.error('❌ Error logging video usage:', error);
    return false;
  }
}

