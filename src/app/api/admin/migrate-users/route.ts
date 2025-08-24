/**
 * User Migration API: Clerk → Google OAuth
 * Admin-only endpoint for migrating existing users
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple admin authentication (replace with proper admin auth)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader === `Bearer ${ADMIN_SECRET}`;
}

/**
 * GET - Get migration status and user list
 */
export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users with their migration status
    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        googleId: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        youtubeAuth: {
          select: {
            id: true,
            expiresAt: true,
            scope: true,
          }
        },
        _count: {
          select: {
            videos: true,
            searches: true,
            usageLogs: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Categorize users
    const stats = {
      total: users.length,
      clerkOnly: users.filter(u => u.clerkId && !u.googleId).length,
      googleOnly: users.filter(u => !u.clerkId && u.googleId).length,
      both: users.filter(u => u.clerkId && u.googleId).length,
      withYouTubeAuth: users.filter(u => u.youtubeAuth).length,
      withContent: users.filter(u => u._count.videos > 0 || u._count.searches > 0).length,
    };

    const needsMigration = users.filter(u => u.clerkId && !u.googleId);

    console.log(`📊 Migration status: ${stats.clerkOnly} users need migration`);

    return NextResponse.json({
      stats,
      needsMigration: needsMigration.map(user => ({
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        hasYouTubeAuth: !!user.youtubeAuth,
        contentCount: user._count.videos + user._count.searches,
        usageCount: user._count.usageLogs,
      })),
      migrated: users.filter(u => u.googleId).map(user => ({
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        migrationDate: user.updatedAt,
      }))
    });

  } catch (error) {
    console.error('❌ Migration status error:', error);
    return NextResponse.json({
      error: 'Failed to get migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST - Migrate specific user by email matching
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, clerkUserId, googleId, email } = await request.json();

    if (action === 'migrate_by_email') {
      // Migrate user by matching email addresses
      if (!email) {
        return NextResponse.json({ error: 'Email is required for migration' }, { status: 400 });
      }

      // Find Clerk user by email
      const clerkUser = await prisma.user.findFirst({
        where: {
          email: email,
          clerkId: { not: null },
          googleId: null,
        }
      });

      if (!clerkUser) {
        return NextResponse.json({ 
          error: 'No unmigrated Clerk user found with this email' 
        }, { status: 404 });
      }

      // For now, we'll mark the user as ready for migration
      // The actual googleId will be set when they log in with Google OAuth
      await prisma.user.update({
        where: { id: clerkUser.id },
        data: {
          updatedAt: new Date(),
          // Note: googleId will be set when user authenticates with Google
        }
      });

      console.log(`✅ User prepared for migration: ${email} (${clerkUser.id})`);

      return NextResponse.json({
        success: true,
        message: `User ${email} prepared for Google OAuth migration`,
        userId: clerkUser.id,
        note: 'User will complete migration on next Google OAuth login'
      });
    }

    if (action === 'force_migrate') {
      // Force migrate specific user (admin only)
      if (!clerkUserId || !googleId) {
        return NextResponse.json({ 
          error: 'Both clerkUserId and googleId are required' 
        }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId }
      });

      if (!user) {
        return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 });
      }

      // Check if googleId is already taken
      const existingGoogleUser = await prisma.user.findUnique({
        where: { googleId: googleId }
      });

      if (existingGoogleUser) {
        return NextResponse.json({ 
          error: 'Google ID is already associated with another user' 
        }, { status: 409 });
      }

      // Perform migration
      const migratedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleId,
          updatedAt: new Date(),
        }
      });

      console.log(`✅ Force migrated user: ${user.email} (${clerkUserId} → ${googleId})`);

      return NextResponse.json({
        success: true,
        message: 'User migrated successfully',
        user: {
          id: migratedUser.id,
          email: migratedUser.email,
          clerkId: migratedUser.clerkId,
          googleId: migratedUser.googleId,
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DELETE - Clean up orphaned data
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'cleanup_orphaned_youtube_auth') {
      // Find YouTube auth records and check if their users exist
      const allAuth = await prisma.youTubeAuth.findMany({
        include: {
          user: true
        }
      });

      const orphanedAuth = allAuth.filter(auth => !auth.user);

      if (orphanedAuth.length > 0) {
        await prisma.youTubeAuth.deleteMany({
          where: {
            id: { in: orphanedAuth.map(auth => auth.id) }
          }
        });
      }

      console.log(`🧹 Cleaned up ${orphanedAuth.length} orphaned YouTube auth records`);

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${orphanedAuth.length} orphaned YouTube auth records`
      });
    }

    if (action === 'remove_empty_clerk_users') {
      // Remove Clerk users with no content (videos, searches, usage logs)
      const emptyUsers = await prisma.user.findMany({
        where: {
          clerkId: { not: null },
          googleId: null,
          videos: { none: {} },
          searches: { none: {} },
          usageLogs: { none: {} },
          youtubeAuth: null,
        },
        select: { id: true, email: true }
      });

      if (emptyUsers.length > 0) {
        await prisma.user.deleteMany({
          where: {
            id: { in: emptyUsers.map(u => u.id) }
          }
        });
      }

      console.log(`🧹 Removed ${emptyUsers.length} empty Clerk users`);

      return NextResponse.json({
        success: true,
        message: `Removed ${emptyUsers.length} empty Clerk users`,
        removedUsers: emptyUsers.map(u => u.email)
      });
    }

    return NextResponse.json({ error: 'Invalid cleanup action' }, { status: 400 });

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json({
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}