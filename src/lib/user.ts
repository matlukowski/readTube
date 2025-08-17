import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function getOrCreateUser() {
  const user = await currentUser();
  
  if (!user) {
    return null;
  }

  // Find or create user in database
  const dbUser = await prisma.user.upsert({
    where: { clerkId: user.id },
    update: {
      email: user.emailAddresses[0]?.emailAddress || '',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || null,
    },
    create: {
      clerkId: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || null,
    },
  });

  return dbUser;
}

export async function getUserByClerkId(clerkId: string) {
  return await prisma.user.findUnique({
    where: { clerkId },
  });
}