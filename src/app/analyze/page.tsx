'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { ArrowLeft, Clock, Eye, BookOpen, Save, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import AnalyzeBar from '@/components/analyze/AnalyzeBar';
import Header from '@/components/layout/Header';
import PaymentModal from '@/components/payments/PaymentModal';
import { YouTubeAuth } from '@/components/YouTubeAuth';
import { extractYouTubeId } from '@/components/analyze/AnalyzeBar';
import { formatMinutesToTime } from '@/lib/stripe';
import { useYouTubeTranscript } from '@/hooks/useYouTubeTranscript';
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

interface AnalysisResult {
  videoDetails: VideoDetails;
  transcript: string;
  summary: string;
  saved: boolean;
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { extractTranscript } = useYouTubeTranscript();
  const { extractWithFallback, overallProgress, extractionMethod } = useMultiModalExtraction();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'analyzing' | 'completed' | 'error'>('input');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<{
    step: string;
    completed: boolean;
  }[]>([]);
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

  const updateProgress = (stepName: string, completed: boolean = false) => {
    setProgress(prev => {
      const existingIndex = prev.findIndex(p => p.step === stepName);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { step: stepName, completed };
        return updated;
      } else {
        return [...prev, { step: stepName, completed }];
      }
    });
  };

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
    setProgress([]);
    setAnalysisResult(null);

    try {
      // Extract YouTube ID if URL was provided
      const youtubeId = extractYouTubeId(youtubeIdOrUrl) || youtubeIdOrUrl;
      
      if (!youtubeId) {
        throw new Error('Nieprawidłowy link YouTube');
      }

      console.log('🎯 Starting analysis for video:', youtubeId);

      // Step 1: Get video details
      updateProgress('Pobieranie szczegółów filmu...');
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
      updateProgress('Pobieranie szczegółów filmu...', true);

      // Step 2: Try client-side extraction first
      updateProgress('Pobieranie napisów z YouTube...');
      let transcript = null;
      let transcriptSource = 'client';
      
      try {
        // Attempt client-side extraction
        console.log('🌐 Attempting client-side transcript extraction...');
        transcript = await extractTranscript(youtubeId);
        
        if (transcript) {
          console.log('✅ Client-side extraction successful');
          updateProgress('Pobieranie napisów z YouTube...', true);
        }
      } catch (clientError) {
        console.warn('⚠️ Client-side extraction failed:', clientError);
      }
      
      // Step 2b: Send transcript to server (or attempt server extraction as fallback)
      updateProgress('Przetwarzanie transkrypcji...');
      const transcriptResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          youtubeId, 
          language,
          transcript // Send client transcript if available
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
        
        // If server requires client extraction and we haven't done it yet
        if (errorData.requiresClientExtraction && !transcript) {
          console.log('⚠️ Server requires client extraction, but captions failed. Trying audio extraction...');
          
          // Last resort: try audio extraction as fallback
          try {
            updateProgress('Próba transkrypcji audio...');
            const audioResult = await extractWithFallback(youtubeId, language);
            
            if (audioResult) {
              transcript = audioResult.transcript;
              transcriptSource = 'audio-fallback';
              console.log('✅ Audio extraction fallback successful');
              updateProgress('Transkrypcja audio zakończona', true);
            }
          } catch (audioError) {
            console.error('❌ Server audio extraction failed:', audioError);
            
            // Ultimate fallback: client-side audio extraction
            console.log('🎵 Trying client-side audio extraction...');
            try {
              updateProgress('Próba transkrypcji audio w przeglądarce...');
              
              const clientTranscript = await extractAndTranscribeClientSide(youtubeId, {
                language: language,
                onProgress: updateProgress
              });
              
              if (clientTranscript && clientTranscript.trim().length > 0) {
                transcript = clientTranscript;
                transcriptSource = 'client-side-audio';
                console.log('✅ Client-side audio extraction successful');
                updateProgress('Transkrypcja audio ukończona!', true);
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
            updateProgress('Próba transkrypcji audio w przeglądarce...');
            
            const clientTranscript = await extractAndTranscribeClientSide(youtubeId, {
              language: language,
              onProgress: updateProgress
            });
            
            if (clientTranscript && clientTranscript.trim().length > 0) {
              transcript = clientTranscript;
              transcriptSource = 'client-side-audio';
              console.log('✅ Client-side audio extraction successful');
              updateProgress('Transkrypcja audio ukończona!', true);
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
      updateProgress('Przetwarzanie transkrypcji...', true);

      // Step 3: Generate summary
      updateProgress('Tworzenie podsumowania AI...');
      const summaryResponse = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          maxLength: 1000,
          style: 'paragraph',
          language
        })
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        throw new Error(errorData.error || 'Nie udało się wygenerować podsumowania');
      }

      const { summary } = await summaryResponse.json();
      updateProgress('Tworzenie podsumowania AI...', true);

      // Step 4: Save to library
      updateProgress('Zapisywanie do biblioteki...');
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
          transcript,
          summary
        })
      });

      await saveResponse.json();
      updateProgress('Zapisywanie do biblioteki...', true);

      // Complete analysis
      setAnalysisResult({
        videoDetails,
        transcript,
        summary,
        saved: saveResponse.ok
      });
      setCurrentStep('completed');

      console.log('✅ Analysis completed successfully');

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
    setAnalysisResult(null);
    setError('');
    setProgress([]);
    setHasInitialized(false);
    isAnalyzingRef.current = false;
    // Clear URL params
    router.push('/analyze');
  };


  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* YouTube Authorization Banner */}
        {isSignedIn && <YouTubeAuth variant="banner" />}
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
            <h1 className="text-3xl font-bold mb-8">Analizuję film...</h1>
            
            <div className="space-y-4">
              {progress.map((step, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-base-100 rounded-lg">
                  <div className="flex flex-col">
                    <span className="font-medium">{step.step}</span>
                    {extractionMethod === 'audio' && !step.completed && overallProgress && (
                      <span className="text-sm text-base-content/60 mt-1">{overallProgress}</span>
                    )}
                  </div>
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <span className="loading loading-spinner loading-sm"></span>
                  )}
                </div>
              ))}
            </div>

            {/* Additional info for audio extraction */}
            {extractionMethod === 'audio' && (
              <div className="mt-6 p-4 bg-info/10 border border-info/20 rounded-lg">
                <div className="flex items-center gap-2 text-info mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Transkrypcja audio</span>
                </div>
                <p className="text-sm text-base-content/70">
                  Napisy nie są dostępne dla tego filmu, więc pobieramy audio i tworzymy transkrypcję automatycznie. 
                  Ten proces może potrwać kilka minut.
                </p>
              </div>
            )}

            <div className="mt-8">
              <div className="text-sm text-base-content/60">
                To może potrwać kilka minut...
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

        {/* Completed Step */}
        {currentStep === 'completed' && analysisResult && (
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Video Details */}
              <div className="lg:col-span-1">
                <div className="card bg-base-100 shadow-xl">
                  <figure className="relative">
                    <Image
                      src={analysisResult.videoDetails.thumbnail}
                      alt={analysisResult.videoDetails.title}
                      width={320}
                      height={180}
                      className="w-full h-48 object-cover"
                    />
                    {analysisResult.videoDetails.duration && (
                      <span className="absolute bottom-2 right-2 badge badge-neutral">
                        <Clock className="w-3 h-3 mr-1" />
                        {analysisResult.videoDetails.duration}
                      </span>
                    )}
                  </figure>
                  
                  <div className="card-body">
                    <h2 className="card-title line-clamp-2">{analysisResult.videoDetails.title}</h2>
                    <p className="text-sm text-base-content/70">{analysisResult.videoDetails.channelName}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-base-content/60 mt-2">
                      {analysisResult.videoDetails.viewCount && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {analysisResult.videoDetails.viewCount}
                        </span>
                      )}
                    </div>

                    {analysisResult.videoDetails.description && (
                      <p className="text-sm mt-2 line-clamp-3">{analysisResult.videoDetails.description}</p>
                    )}

                    <div className="card-actions justify-between mt-4">
                      <a
                        href={`https://youtube.com/watch?v=${analysisResult.videoDetails.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        YouTube
                      </a>
                      
                      {analysisResult.saved && (
                        <span className="badge badge-success">
                          <Save className="w-3 h-3 mr-1" />
                          Zapisane
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="lg:col-span-2">
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title mb-4">
                      <BookOpen className="w-5 h-5" />
                      Podsumowanie filmu
                    </h2>
                    
                    <div className="prose prose-sm max-w-none">
                      {analysisResult.summary.split('\n').map((paragraph, index) => (
                        <p key={index} className="mb-4 leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>

                    {/* Footer with paraphrase information */}
                    <div className="mt-6 pt-4 border-t border-base-300">
                      <p className="text-xs text-base-content/60 leading-relaxed">
                        💡 <strong>Informacja:</strong> Powyższy tekst to parafraza słów autora filmu. 
                        Aby zapoznać się w pełni z treścią, obejrzyj oryginalny film klikając przycisk{' '}
                        <span className="font-medium">{'"YouTube"'}</span> pod miniaturką.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Success message */}
            <div className="text-center mt-8">
              <div className="alert alert-success max-w-md mx-auto">
                <CheckCircle className="w-5 h-5" />
                <span>Film został pomyślnie przeanalizowany i zapisany do biblioteki!</span>
              </div>
            </div>
          </div>
        )}
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