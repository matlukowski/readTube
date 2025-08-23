// Migration script to add payment system fields to existing users
// Run this after deploying the new schema: npx tsx src/scripts/migrateUsers.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingUsers() {
  console.log('🚀 Starting user migration for payment system...');

  try {
    // Get all users without payment system fields
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        minutesUsed: true,
        minutesPurchased: true,
        subscriptionStatus: true,
      },
    });

    console.log(`📊 Found ${users.length} users to potentially migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if user already has payment fields set up
      if (user.minutesPurchased === 60 && user.subscriptionStatus === 'FREE' && user.minutesUsed === 0) {
        console.log(`⏭️ User ${user.email} already migrated, skipping`);
        skipped++;
        continue;
      }

      // Migrate user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          minutesUsed: 0, // Reset usage for fresh start
          minutesPurchased: 60, // Give everyone 1 hour free
          subscriptionStatus: 'FREE',
          lastPurchaseAt: null,
        },
      });

      console.log(`✅ Migrated user: ${user.email} (${user.id})`);
      migrated++;

      // Add a small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📈 Migration completed!`);
    console.log(`   ✅ Migrated: ${migrated} users`);
    console.log(`   ⏭️ Skipped: ${skipped} users`);
    console.log(`   🎯 Total: ${users.length} users processed`);

    // Create some sample usage logs for testing (optional)
    const shouldCreateSampleData = process.argv.includes('--sample-data');
    if (shouldCreateSampleData) {
      console.log('\n🧪 Creating sample usage data...');
      
      // Find first user for sample data
      const firstUser = users[0];
      if (firstUser) {
        await prisma.usageLog.createMany({
          data: [
            {
              userId: firstUser.id,
              youtubeId: 'dQw4w9WgXcQ',
              videoTitle: 'Rick Astley - Never Gonna Give You Up (Sample)',
              videoDuration: '3:33',
              minutesUsed: 4,
            },
            {
              userId: firstUser.id,
              youtubeId: 'jNQXAC9IVRw',
              videoTitle: 'Me at the zoo (Sample)',
              videoDuration: '0:19',
              minutesUsed: 1,
            },
          ],
        });

        // Update user's minutes used
        await prisma.user.update({
          where: { id: firstUser.id },
          data: { minutesUsed: 5 },
        });

        console.log(`   📊 Created sample usage logs for ${firstUser.email}`);
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  console.log('🔄 User Payment System Migration');
  console.log('=================================\n');
  
  migrateExistingUsers()
    .then(() => {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateExistingUsers };