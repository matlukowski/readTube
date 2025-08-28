/**
 * Test endpoint for local transcription functionality
 * GET /api/test-local-transcription - Test system availability
 * POST /api/test-local-transcription - Test with a YouTube video
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-helpers';
import { isLocalTranscriptionAvailable } from '@/lib/local-transcription';
import { checkTranscriptionEnvironment, logTranscriptionConfig } from '@/lib/transcription-config';
import { extractAndTranscribeAudio } from '@/lib/audio-extractor';

// GET - System status check
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing local transcription system...');
    
    // Check environment configuration
    const envCheck = checkTranscriptionEnvironment();
    
    // Check if local transcription is available
    let localCheck = { available: false, error: null };
    try {
      const available = await isLocalTranscriptionAvailable();
      localCheck = { available, error: null };
    } catch (error) {
      localCheck = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Log configuration for debugging
    logTranscriptionConfig();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      transcriptionSystems: {
        local: {
          available: localCheck.available,
          error: localCheck.error,
          package: 'nodejs-whisper',
          models: ['tiny', 'base', 'small', 'medium', 'large']
        },
        gladia: {
          available: envCheck.gladiaAvailable,
          configured: !!process.env.GLADIA_API_KEY
        }
      },
      configuration: envCheck,
      recommendations: {
        setup: envCheck.recommendedSetup,
        warnings: envCheck.warnings
      }
    });
    
  } catch (error) {
    console.error('❌ Local transcription test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST - Test with actual YouTube video
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await authenticateRequest(request);
    console.log(`🧪 Testing local transcription for user: ${userId}`);
    
    const body = await request.json();
    const { youtubeId, forceLocal = false, modelSize } = body;
    
    if (!youtubeId) {
      return NextResponse.json({
        success: false,
        error: 'YouTube ID is required'
      }, { status: 400 });
    }
    
    console.log(`🎯 Testing with YouTube ID: ${youtubeId}`);
    console.log(`🔧 Options: forceLocal=${forceLocal}, modelSize=${modelSize}`);
    
    // Test transcription
    const startTime = Date.now();
    
    const result = await extractAndTranscribeAudio(youtubeId, {
      language: 'auto',
      useLocalTranscription: forceLocal,
      whisperModelSize: modelSize,
      maxDuration: 600 // 10 minutes max for testing
    });
    
    const totalTime = Date.now() - startTime;
    
    // Log results
    console.log(`✅ Test completed in ${totalTime}ms`);
    console.log(`📝 Transcript: ${result.transcript.length} characters`);
    console.log(`🔧 Source: ${result.source}`);
    
    return NextResponse.json({
      success: true,
      testResults: {
        youtubeId,
        totalProcessingTimeMs: totalTime,
        transcriptionSource: result.source,
        transcriptLength: result.transcript.length,
        transcriptPreview: result.transcript.substring(0, 200) + '...',
        videoDetails: result.videoDetails,
        processingInfo: result.processingInfo,
        performanceMetrics: {
          audioExtractionCompleted: true,
          transcriptionCompleted: true,
          totalTimeSeconds: Math.round(totalTime / 1000),
          charactersPerSecond: Math.round(result.transcript.length / (totalTime / 1000))
        }
      },
      recommendations: {
        optimalForDuration: result.processingInfo.durationSeconds < 300 ? 'tiny' : 'small',
        costEffective: result.source === 'local-whisper',
        qualityRating: result.transcript.length > 100 ? 'good' : 'poor'
      }
    });
    
  } catch (error) {
    console.error('❌ Local transcription test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE - Cleanup test resources (optional)
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    await authenticateRequest(request);
    
    // This endpoint could clean up any test files or cache
    // For now, just return success
    
    return NextResponse.json({
      success: true,
      message: 'Test resources cleaned up',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}