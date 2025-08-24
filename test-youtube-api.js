/**
 * Simple test script for YouTube Data API v3 integration
 * Run this with: node test-youtube-api.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim().replace(/^"/, '').replace(/"$/, '');
      }
    }
  }
}

async function testYouTubeAPI() {
  console.log('🧪 Testing YouTube Data API v3 integration...\n');
  
  loadEnv();
  
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    console.log('❌ YOUTUBE_API_KEY not found in .env file');
    console.log('Please add your YouTube API key to .env file:');
    console.log('YOUTUBE_API_KEY=your_api_key_here\n');
    process.exit(1);
  }
  
  console.log(`✅ Found API key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);
  
  // Test video ID (a popular video that should have captions)
  const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll - likely has captions
  console.log(`🎯 Testing with video ID: ${testVideoId}\n`);
  
  try {
    // Step 1: Test video metadata
    console.log('📊 Step 1: Testing video metadata...');
    const metadataUrl = `https://www.googleapis.com/youtube/v3/videos?id=${testVideoId}&part=snippet,contentDetails&key=${apiKey}`;
    
    const metadataResponse = await fetch(metadataUrl);
    if (!metadataResponse.ok) {
      const error = await metadataResponse.text();
      throw new Error(`Metadata API failed: ${metadataResponse.status} - ${error}`);
    }
    
    const metadataResult = await metadataResponse.json();
    
    if (!metadataResult.items || metadataResult.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = metadataResult.items[0];
    console.log(`   ✅ Video: "${video.snippet.title}"`);
    console.log(`   📅 Published: ${video.snippet.publishedAt}`);
    console.log(`   ⏱️  Duration: ${video.contentDetails.duration}`);
    console.log(`   👤 Channel: ${video.snippet.channelTitle}\n`);
    
    // Step 2: Test caption tracks
    console.log('📝 Step 2: Testing caption tracks...');
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?videoId=${testVideoId}&part=snippet&key=${apiKey}`;
    
    const captionsResponse = await fetch(captionsUrl);
    if (!captionsResponse.ok) {
      const error = await captionsResponse.text();
      throw new Error(`Captions API failed: ${captionsResponse.status} - ${error}`);
    }
    
    const captionsResult = await captionsResponse.json();
    
    if (!captionsResult.items || captionsResult.items.length === 0) {
      console.log('   ⚠️  No captions available for this video');
      console.log('   💡 Try testing with a different video that has captions\n');
      return;
    }
    
    console.log(`   ✅ Found ${captionsResult.items.length} caption track(s):`);
    
    for (const caption of captionsResult.items) {
      const isAuto = caption.snippet.isAutoSynced ? ' (auto-generated)' : '';
      console.log(`   - ${caption.snippet.name} (${caption.snippet.language})${isAuto}`);
    }
    
    // Step 3: Test caption download (first track)
    console.log('\n📥 Step 3: Testing caption download...');
    const firstCaption = captionsResult.items[0];
    const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${firstCaption.id}?tfmt=srt&key=${apiKey}`;
    
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
      const error = await downloadResponse.text();
      throw new Error(`Caption download failed: ${downloadResponse.status} - ${error}`);
    }
    
    const captionContent = await downloadResponse.text();
    console.log(`   ✅ Downloaded caption content (${captionContent.length} characters)`);
    
    // Show first few lines as preview
    const lines = captionContent.split('\n').slice(0, 10);
    console.log('   📄 Preview:');
    console.log('   ' + lines.map(line => '   ' + line).join('\n'));
    
    if (captionContent.length > 500) {
      console.log('   ...(truncated)');
    }
    
    console.log('\n✅ YouTube Data API v3 test completed successfully!');
    console.log('🎉 Your API key is working correctly and can fetch captions.');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}\n`);
    
    if (error.message.includes('403') || error.message.includes('forbidden')) {
      console.log('💡 This might be an API key permissions issue.');
      console.log('   Make sure your API key has YouTube Data API v3 enabled.\n');
    } else if (error.message.includes('quota')) {
      console.log('💡 This might be a quota/billing issue.');
      console.log('   Check your Google Cloud Console for quota limits.\n');
    }
    
    console.log('🔧 Troubleshooting steps:');
    console.log('1. Check your API key in Google Cloud Console');
    console.log('2. Make sure YouTube Data API v3 is enabled');
    console.log('3. Check quota limits and billing');
    console.log('4. Verify the API key has correct permissions');
  }
}

// Run the test
testYouTubeAPI();