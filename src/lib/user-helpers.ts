/**
 * User helpers for Clerk integration
 * Handles user lookup and automatic creation for new Clerk users
 */

import { prisma } from './prisma';
import { currentUser } from '@clerk/nextjs/server';

export interface DatabaseUser {
  id: string;
  clerkId: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  minutesUsed: number;
  minutesPurchased: number;
  subscriptionStatus: string;
}

/**
 * Get or create a database user for the current Clerk user
 * Handles user creation and migration
 */
export async function getOrCreateCurrentUser(clerkUserId: string): Promise<DatabaseUser> {
  // Step 1: Try to find existing user by Clerk ID (already migrated)
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });

  if (user) {
    return user;
  }

  // Step 2: Get Clerk user info for email lookup and user creation
  const clerkUser = await currentUser();
  
  if (!clerkUser) {
    throw new Error('Clerk user not found');
  }

  const userEmail = clerkUser.emailAddresses[0]?.emailAddress;
  if (!userEmail) {
    throw new Error('Clerk user has no email address');
  }

  // Step 3: Check if user exists by email (existing user without Clerk ID)
  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (existingUser) {
    // Existing user found - add Clerk ID
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        clerkId: clerkUserId,
        // Also update name if not set or changed
        name: existingUser.name || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
      },
    });

    console.log(`🔄 Migrated existing user to Clerk ID: ${clerkUserId} (${userEmail})`);
    return user;
  }

  // Step 4: No existing user found - create completely new user
  user = await prisma.user.create({
    data: {
      clerkId: clerkUserId,
      email: userEmail,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
      minutesUsed: 0,
      minutesPurchased: 999999, // Unlimited for free app
      subscriptionStatus: 'FREE',
    },
  });

  console.log(`✅ Created new database user for Clerk ID: ${clerkUserId} (${userEmail})`);
  return user;
}