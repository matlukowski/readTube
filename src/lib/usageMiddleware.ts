import { prisma } from '@/lib/prisma';
import { getOrCreateUser } from '@/lib/user';
import { getRemainingMinutes } from '@/lib/stripe';
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
export async function checkUsageLimit(youtubeId: string): Promise<UsageCheckResult> {
  try {
    // Get user from database
    const user = await getOrCreateUser();
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
    const requiredMinutes = youtubeAPI.parseDurationToMinutes(videoData.contentDetails.duration);

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
}: {
  youtubeId: string;
  videoTitle: string;
  videoDuration: string;
  minutesUsed: number;
}): Promise<boolean> {
  try {
    const user = await getOrCreateUser();
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

/**
 * Get user's current usage summary
 */
export async function getUserUsageSummary() {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return null;
    }

    const remainingMinutes = getRemainingMinutes(user.minutesUsed, user.minutesPurchased);
    const canAnalyze = remainingMinutes > 0;

    return {
      user: {
        id: user.id,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
      },
      usage: {
        minutesUsed: user.minutesUsed,
        minutesPurchased: user.minutesPurchased,
        remainingMinutes,
        canAnalyze,
        percentageUsed: Math.round((user.minutesUsed / user.minutesPurchased) * 100),
      },
    };
  } catch (error) {
    console.error('Error getting usage summary:', error);
    return null;
  }
}