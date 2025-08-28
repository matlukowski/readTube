'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
// import Image from 'next/image'; // Unused after UI simplification
import { ArrowLeft, AlertCircle } from 'lucide-react';
import AnalyzeBar from '@/components/analyze/AnalyzeBar';
import Header from '@/components/layout/Header';
import PaymentModal from '@/components/payments/PaymentModal';
import { extractYouTubeId } from '@/components/analyze/AnalyzeBar';
import { formatMinutesToTime } from '@/lib/stripe';
import { useMultiModalExtraction } from '@/hooks/useAudioExtraction';
import { extractAndTranscribeClientSide } from '@/lib/client-audio-extractor';

interface VideoDetails {
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  description?: string;
}

// AnalysisResult interface removed - now we redirect to /video/[id] instead

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // For now, assume user is signed in - Google OAuth will be handled at app level  
  const isSignedIn = true;
  const { extractWithFallback, overallProgress, extractionMethod } = useMultiModalExtraction();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'analyzing' | 'error'>('input');
  const [error, setError] = useState<string>('');
  // Progress tracking simplified - using extractionMethod and overallProgress from hooks
  const [hasInitialized, setHasInitialized] = useState(false);
  const [language, setLanguage] = useState('pl');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{
    remainingMinutes: number;
    requiredMinutes: number;
    subscriptionStatus: string;
    formattedRemaining: string;
  } | null>(null);
  const isAnalyzingRef = useRef(false);

  // Get language from localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') || 'pl';
    setLanguage(savedLanguage);

    // Listen for language changes
    const handleLanguageChange = (event: CustomEvent) => {
      setLanguage(event.detail);
    };

    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('languageChange', handleLanguageChange as EventListener);
    };
  }, []);

  // Get video ID from URL params on mount
  useEffect(() => {
    const videoParam = searchParams.get('v');
    if (videoParam && !hasInitialized && !isAnalyzing && !isAnalyzingRef.current) {
      setHasInitialized(true);
      handleAnalyze(videoParam);
    }
  }, [searchParams, hasInitialized, isAnalyzing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress tracking simplified - no longer needed

  const handleAnalyze = async (youtubeIdOrUrl: string) => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Prevent duplicate calls with double protection
    if (isAnalyzing || isAnalyzingRef.current) {
      console.log('⚠️ Analysis already in progress, skipping duplicate call');
      return;
    }

    setIsAnalyzing(true);
    isAnalyzingRef.current = true;
    setCurrentStep('analyzing');
    setError('');
    // Reset analysis state - no longer needed since we redirect to /video page

    try {
      // Extract YouTube ID if URL was provided
      const youtubeId = extractYouTubeId(youtubeIdOrUrl) || youtubeIdOrUrl;
      
      if (!youtubeId) {
        throw new Error('Nieprawidłowy link YouTube');
      }

      console.log('🎯 Starting analysis for video:', youtubeId);

      // Step 1: Get video details
      const detailsResponse = await fetch('/api/video-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId })
      });

      if (!detailsResponse.ok) {
        const errorData = await detailsResponse.json();
        throw new Error(errorData.error || 'Nie udało się pobrać szczegółów filmu');
      }

      const videoDetails: VideoDetails = await detailsResponse.json();
      // Video details fetched

      // Initialize transcript variables  
      let transcript = null;
      let transcriptSource = 'server';

      // Step 2: Process transcript with Gladia API
      console.log('🚀 Starting Gladia API transcription...');
      const transcriptResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          youtubeId, 
          language
        })
      });

      if (!transcriptResponse.ok) {
        const errorData = await transcriptResponse.json();
        
        // Check if this is a usage limit error (402 Payment Required)
        if (transcriptResponse.status === 402 && errorData.upgradeRequired) {
          console.log('💳 Usage limit exceeded, showing payment modal');
          setUsageInfo({
            ...errorData.usageInfo,
            formattedRemaining: formatMinutesToTime(errorData.usageInfo.remainingMinutes)
          });
          setShowPaymentModal(true);
          setCurrentStep('input'); // Return to input step
          return; // Don't throw error, just show payment modal
        }
        
        // If server extraction fails, try client-side audio extraction
        if (errorData.requiresClientExtraction) {
          console.log('⚠️ Server extraction failed. Trying client-side audio extraction...');
          
          // Last resort: try audio extraction as fallback
          try {
            // Starting audio transcription
            const audioResult = await extractWithFallback(youtubeId, language);
            
            if (audioResult) {
              transcript = audioResult.transcript;
              transcriptSource = 'audio-fallback';
              console.log('✅ Audio extraction fallback successful');
              // Audio transcription completed
            }
          } catch (audioError) {
            console.error('❌ Server audio extraction failed:', audioError);
            
            // Ultimate fallback: client-side audio extraction
            console.log('🎵 Trying client-side audio extraction...');
            try {
              // Starting client-side transcription
              
              const clientTranscript = await extractAndTranscribeClientSide(youtubeId, {
                language: language,
                // Progress handled by hook
              });
              
              if (clientTranscript && clientTranscript.trim().length > 0) {
                transcript = clientTranscript;
                transcriptSource = 'client-side-audio';
                console.log('✅ Client-side audio extraction successful');
                // Client-side transcription completed
              } else {
                throw new Error('Client-side extraction returned empty result');
              }
              
            } catch (clientError) {
              console.error('❌ Client-side audio extraction failed:', clientError);
              throw new Error('Nie udało się pobrać napisów ani transkrypcji audio. Sprawdź czy film ma napisy lub nie jest prywatny.');
            }
          }
        } else {
          // Server API error but no fallback available
          console.log('🎵 Server failed, trying client-side audio extraction...');
          try {
            // Starting browser transcription fallback
            
            const clientTranscript = await extractAndTranscribeClientSide(youtubeId, {
              language: language,
              // Progress handled by hook
            });
            
            if (clientTranscript && clientTranscript.trim().length > 0) {
              transcript = clientTranscript;
              transcriptSource = 'client-side-audio';
              console.log('✅ Client-side audio extraction successful');
              // Browser transcription completed
            } else {
              throw new Error('Client-side extraction returned empty result');
            }
            
          } catch (clientError) {
            console.error('❌ Client-side audio extraction failed:', clientError);
            throw new Error(errorData.error || 'Nie udało się wygenerować transkrypcji');
          }
        }
      }

      const transcriptData = await transcriptResponse.json();
      transcript = transcriptData.transcript;
      transcriptSource = transcriptData.source || transcriptSource;
      
      console.log(`📊 Transcript ready (source: ${transcriptSource})`);
      // Transcript processed

      // Step 3: Save to library (skip summary generation)
      // Saving to library
      const saveResponse = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeId,
          title: videoDetails.title,
          channelName: videoDetails.channelName,
          thumbnail: videoDetails.thumbnail,
          duration: videoDetails.duration,
          viewCount: videoDetails.viewCount,
          publishedAt: videoDetails.publishedAt,
          description: videoDetails.description,
          transcript
        })
      });

      await saveResponse.json();
      // Saved to library successfully

      // Complete analysis - redirect to library 
      console.log('✅ Analysis completed successfully');
      
      // Redirect to library where user can chat with all their videos
      router.push('/library');

    } catch (err) {
      console.error('❌ Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd');
      setCurrentStep('error');
    } finally {
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
    }
  };

  const handleBackToInput = () => {
    setCurrentStep('input');
    setError('');
    // Reset analysis state
    setHasInitialized(false);
    isAnalyzingRef.current = false;
    // Clear URL params
    router.push('/analyze');
  };


  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* YouTube Authorization Banner - using new auth system via AuthContext */}
        {/* Back button when not on input step */}
        {currentStep !== 'input' && (
          <button
            onClick={handleBackToInput}
            className="btn btn-ghost mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Analizuj nowy film
          </button>
        )}

        {/* Input Step */}
        {currentStep === 'input' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4">
                Analizuj film YouTube
              </h1>
              <p className="text-xl text-base-content/70 mb-8">
                Wklej link do filmu YouTube, aby otrzymać szczegółowe podsumowanie AI
              </p>
            </div>

            <AnalyzeBar onAnalyze={handleAnalyze} />

            {/* Steps preview */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-center mb-8">Jak to działa</h2>
              
              <div className="steps steps-vertical lg:steps-horizontal w-full">
                <div className="step step-primary">
                  <div className="text-center mt-4">
                    <h4 className="font-semibold">Wklej URL</h4>
                    <p className="text-sm text-base-content/70">
                      Podaj link do filmu YouTube
                    </p>
                  </div>
                </div>
                
                <div className="step step-primary">
                  <div className="text-center mt-4">
                    <h4 className="font-semibold">Transkrypcja</h4>
                    <p className="text-sm text-base-content/70">
                      Automatyczne generowanie transkrypcji
                    </p>
                  </div>
                </div>
                
                <div className="step step-primary">
                  <div className="text-center mt-4">
                    <h4 className="font-semibold">Podsumowanie AI</h4>
                    <p className="text-sm text-base-content/70">
                      Inteligentne streszczenie treści
                    </p>
                  </div>
                </div>
                
                <div className="step step-primary">
                  <div className="text-center mt-4">
                    <h4 className="font-semibold">Biblioteka</h4>
                    <p className="text-sm text-base-content/70">
                      Automatyczny zapis do kolekcji
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analyzing Step */}
        {currentStep === 'analyzing' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-base-100 rounded-lg p-8 shadow-lg">
              <h1 className="text-3xl font-bold mb-8">Analizuję film...</h1>
              
              <div className="flex flex-col items-center space-y-6">
                {/* Main loading spinner */}
                <div className="loading loading-spinner loading-lg text-primary"></div>
                
                {/* Simple progress message */}
                <div className="text-lg text-base-content/80">
                  Pobieram transkrypcję i tworzę podsumowanie AI
                </div>
                
                {/* Additional progress info if available */}
                {extractionMethod === 'audio' && overallProgress && (
                  <div className="text-sm text-base-content/60 bg-base-200 px-4 py-2 rounded-full">
                    {overallProgress}
                  </div>
                )}
                
                {/* Estimated time hint */}
                <div className="text-sm text-base-content/50">
                  To może potrwać 1-2 minuty...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Step */}
        {currentStep === 'error' && (
          <div className="max-w-2xl mx-auto text-center">
            <div className="alert alert-error">
              <AlertCircle className="w-6 h-6" />
              <div>
                <h3 className="font-bold">Wystąpił błąd</h3>
                <div className="text-sm">{error}</div>
              </div>
            </div>
            
            <button
              onClick={handleBackToInput}
              className="btn btn-primary mt-6"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {/* Completed Step - now just redirects to video page */}
      </main>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userUsage={usageInfo || undefined}
        requiredMinutes={usageInfo?.requiredMinutes}
      />
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  );
}