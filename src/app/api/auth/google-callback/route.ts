import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GoogleUser {
  id: string;
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Handle Google OAuth callback - create or update user
 * POST /api/auth/google-callback
 */
export async function POST(request: Request) {
  try {
    const { user, accessToken, refreshToken } = await request.json() as {
      user: GoogleUser;
      accessToken: string;
      refreshToken?: string;
    };

    if (!user || !user.googleId || !user.email) {
      return NextResponse.json(
        { error: 'Missing required user data' }, 
        { status: 400 }
      );
    }

    console.log(`🔄 Processing Google OAuth for user: ${user.email} (${user.googleId})`);

    // Check if user exists by googleId or email
    let existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: user.googleId },
          { email: user.email }
        ]
      }
    });

    // Handle migration from Clerk to Google OAuth
    if (existingUser && !existingUser.googleId && existingUser.clerkId) {
      console.log(`🔄 Migrating Clerk user to Google OAuth: ${user.email}`);
      console.log(`   Clerk ID: ${existingUser.clerkId} → Google ID: ${user.googleId}`);
      
      // This is a Clerk user logging in with Google OAuth - migrate them
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          googleId: user.googleId,
          name: user.name || existingUser.name, // Update name if Google provides better data
          updatedAt: new Date(),
        }
      });
      
      console.log(`✅ User migration completed: ${user.email} (${existingUser.id})`);
    }

    let dbUser;

    if (existingUser) {
      // Update existing user
      console.log(`✅ Updating existing user: ${existingUser.id}`);
      dbUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          googleId: user.googleId, // Make sure googleId is set
          email: user.email,
          name: user.name,
          updatedAt: new Date(),
        }
      });
    } else {
      // Create new user
      console.log(`🆕 Creating new user for: ${user.email}`);
      dbUser = await prisma.user.create({
        data: {
          googleId: user.googleId,
          email: user.email,
          name: user.name,
          minutesUsed: 0,
          minutesPurchased: 999999, // Free unlimited access
          subscriptionStatus: 'FREE',
        }
      });
    }

    // YouTube OAuth token storage removed - now using simplified Google OAuth
    // Access tokens are managed client-side for basic authentication only
    console.log(`✅ User authenticated with Google OAuth: ${dbUser.id}`);

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        googleId: dbUser.googleId,
        email: dbUser.email,
        name: dbUser.name,
      },
      message: 'User authenticated and tokens stored successfully'
    });

  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    
    return NextResponse.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get current user info
 * GET /api/auth/google-callback
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const googleId = url.searchParams.get('googleId');

    if (!googleId) {
      return NextResponse.json(
        { error: 'Google ID required' }, 
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        minutesUsed: user.minutesUsed,
        minutesPurchased: user.minutesPurchased,
      },
      // YouTube auth status removed - simplified authentication
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    
    return NextResponse.json({
      error: 'Failed to get user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}