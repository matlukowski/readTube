import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface AuthUser {
  id: string;
  googleId: string | null;
  email: string;
  name?: string | null;
}

export async function getCurrentUser(googleId?: string): Promise<AuthUser | null> {
  try {
    if (!googleId) {
      return null;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true,
        googleId: true,
        email: true,
        name: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function getOrCreateUser(googleId: string, email: string, name?: string): Promise<AuthUser> {
  const user = await prisma.user.upsert({
    where: { googleId },
    update: {
      email,
      name: name || null,
    },
    create: {
      googleId,
      email,
      name: name || null,
    },
    select: {
      id: true,
      googleId: true,
      email: true,
      name: true
    }
  });

  return user;
}

export async function getUserByGoogleId(googleId: string): Promise<AuthUser | null> {
  return await prisma.user.findUnique({
    where: { googleId },
    select: {
      id: true,
      googleId: true,
      email: true,
      name: true
    }
  });
}