'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { ArrowLeft, Clock, Eye, BookOpen, Save, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import AnalyzeBar from '@/components/analyze/AnalyzeBar';
import Header from '@/components/layout/Header';
import { extractYouTubeId } from '@/components/analyze/AnalyzeBar';

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

      // Step 2: Get transcript
      updateProgress('Generowanie transkrypcji...');
      const transcriptResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId, language })
      });

      if (!transcriptResponse.ok) {
        const errorData = await transcriptResponse.json();
        throw new Error(errorData.error || 'Nie udało się wygenerować transkrypcji');
      }

      const { transcript } = await transcriptResponse.json();
      updateProgress('Generowanie transkrypcji...', true);

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
                  <span className="font-medium">{step.step}</span>
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <span className="loading loading-spinner loading-sm"></span>
                  )}
                </div>
              ))}
            </div>

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
                        <span className="font-medium">"YouTube"</span> pod miniaturką.
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