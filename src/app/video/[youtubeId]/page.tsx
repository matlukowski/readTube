'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { ArrowLeft, Clock, Eye, ExternalLink, MessageCircle, FileText, Copy } from 'lucide-react';
import Header from '@/components/layout/Header';
import { formatTranscriptForDisplay } from '@/lib/transcript-formatter';

interface VideoData {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  description?: string;
  thumbnail: string;
  transcript?: string;
  summary?: string;
}

interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface ChatHistory {
  youtubeId: string;
  videoTitle: string;
  chats: ChatMessage[];
  totalChats: number;
}

export default function VideoPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const youtubeId = params.youtubeId as string;

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [formattedTranscript, setFormattedTranscript] = useState<ReturnType<typeof formatTranscriptForDisplay> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Chat interface state
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript'>('chat');
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string>('');

  // Authentication redirect
  useEffect(() => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
  }, [isSignedIn, router]);

  // Load video data and chat history
  useEffect(() => {
    if (!youtubeId || !isSignedIn) return;

    const loadVideoData = async () => {
      try {
        setLoading(true);
        setError('');

        // Load video details
        const videoResponse = await fetch('/api/video-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeId })
        });

        if (!videoResponse.ok) {
          throw new Error('Nie udało się pobrać danych filmu');
        }

        const videoDetails = await videoResponse.json();
        
        // Try to get saved video data from database (with transcript)
        const libraryResponse = await fetch(`/api/library?youtubeId=${youtubeId}`);
        let savedVideo = null;
        
        if (libraryResponse.ok) {
          const libraryData = await libraryResponse.json();
          savedVideo = libraryData.videos?.[0];
        }

        setVideoData({
          ...videoDetails,
          transcript: savedVideo?.transcript,
          summary: savedVideo?.summary,
          id: savedVideo?.id || videoDetails.youtubeId
        });

        // Format transcript if available
        if (savedVideo?.transcript) {
          const formatted = formatTranscriptForDisplay(savedVideo.transcript);
          setFormattedTranscript(formatted);
        }

        // Load chat history if video exists in database
        if (savedVideo) {
          const chatResponse = await fetch(`/api/chat-with-video?youtubeId=${youtubeId}`);
          if (chatResponse.ok) {
            const chatData: ChatHistory = await chatResponse.json();
            setChatHistory(chatData.chats);
          }
        }

      } catch (err) {
        console.error('Error loading video data:', err);
        setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas ładowania danych');
      } finally {
        setLoading(false);
      }
    };

    loadVideoData();
  }, [youtubeId, isSignedIn]);

  // Handle chat question submission
  const handleAskQuestion = async () => {
    if (!question.trim() || isAsking || !videoData?.transcript) return;

    setIsAsking(true);
    setChatError('');

    try {
      const response = await fetch('/api/chat-with-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeId,
          question: question.trim(),
          language: 'pl'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się uzyskać odpowiedzi');
      }

      const result = await response.json();
      
      // Add new message to chat history
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        question: question.trim(),
        answer: result.answer,
        createdAt: new Date().toISOString()
      };

      setChatHistory(prev => [...prev, newMessage]);
      setQuestion('');

    } catch (err) {
      console.error('Error asking question:', err);
      setChatError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setIsAsking(false);
    }
  };

  // Handle transcript copy
  const handleCopyTranscript = () => {
    if (videoData?.transcript) {
      navigator.clipboard.writeText(videoData.transcript);
      // Could add toast notification here
    }
  };

  if (!isSignedIn) {
    return null; // Will redirect via useEffect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="min-h-screen bg-base-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="alert alert-error max-w-md mx-auto">
            <div>
              <h3 className="font-bold">Błąd</h3>
              <div className="text-sm">{error || 'Nie znaleziono filmu'}</div>
            </div>
          </div>
          <div className="text-center mt-6">
            <button 
              onClick={() => router.push('/analyze')}
              className="btn btn-primary"
            >
              Wróć do analizowania
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="btn btn-ghost mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wróć
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 shadow-xl sticky top-8">
              <figure className="relative">
                <Image
                  src={videoData.thumbnail}
                  alt={videoData.title}
                  width={400}
                  height={225}
                  className="w-full h-48 object-cover"
                />
                {videoData.duration && (
                  <span className="absolute bottom-2 right-2 badge badge-neutral">
                    <Clock className="w-3 h-3 mr-1" />
                    {videoData.duration}
                  </span>
                )}
              </figure>
              
              <div className="card-body">
                <h2 className="card-title text-sm leading-tight">{videoData.title}</h2>
                <p className="text-sm text-base-content/70 mb-2">{videoData.channelName}</p>
                
                {videoData.viewCount && (
                  <div className="flex items-center gap-1 text-sm text-base-content/60 mb-3">
                    <Eye className="w-3 h-3" />
                    {videoData.viewCount}
                  </div>
                )}

                <div className="card-actions justify-between">
                  <a
                    href={`https://youtube.com/watch?v=${youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    YouTube
                  </a>
                </div>

                {/* Video Stats */}
                <div className="mt-4 pt-4 border-t border-base-300">
                  <div className="stats stats-vertical w-full">
                    {videoData.transcript && (
                      <div className="stat py-2">
                        <div className="stat-title text-xs">Transkrypcja</div>
                        <div className="stat-value text-sm text-success">
                          {Math.round(videoData.transcript.length / 1000)}k znaków
                        </div>
                      </div>
                    )}
                    <div className="stat py-2">
                      <div className="stat-title text-xs">Pytania</div>
                      <div className="stat-value text-sm">{chatHistory.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Tab Navigation */}
            <div className="tabs tabs-boxed mb-6">
              <button 
                className={`tab tab-lg ${activeTab === 'chat' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat z filmem
              </button>
              <button 
                className={`tab tab-lg ${activeTab === 'transcript' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('transcript')}
                disabled={!videoData.transcript}
              >
                <FileText className="w-4 h-4 mr-2" />
                Transkrypcja
                {!videoData.transcript && (
                  <span className="badge badge-xs badge-warning ml-2">Brak</span>
                )}
              </button>
            </div>

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  {!videoData.transcript ? (
                    // No transcript available
                    <div className="text-center py-12">
                      <MessageCircle className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
                      <h3 className="text-xl font-bold mb-2">Brak transkrypcji</h3>
                      <p className="text-base-content/70 mb-6">
                        Aby móc zadawać pytania o ten film, najpierw musisz go przeanalizować.
                      </p>
                      <button
                        onClick={() => router.push(`/analyze?v=${youtubeId}`)}
                        className="btn btn-primary"
                      >
                        Przeanalizuj film
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Chat History */}
                      <div className="h-96 overflow-y-auto mb-4 space-y-4">
                        {chatHistory.length === 0 ? (
                          <div className="text-center py-12">
                            <MessageCircle className="w-12 h-12 mx-auto text-base-content/30 mb-4" />
                            <p className="text-base-content/70">
                              Zadaj pierwsze pytanie o ten film! 💬
                            </p>
                            <div className="mt-4 text-sm text-base-content/50">
                              <p>Przykładowe pytania:</p>
                              <ul className="mt-2 space-y-1">
                                <li>• O czym jest ten film?</li>
                                <li>• Jakie są główne punkty?</li>
                                <li>• Wyjaśnij mi [konkretny fragment]</li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          chatHistory.map((message) => (
                            <div key={message.id} className="space-y-3">
                              {/* Question */}
                              <div className="chat chat-end">
                                <div className="chat-bubble chat-bubble-primary">
                                  {message.question}
                                </div>
                              </div>
                              {/* Answer */}
                              <div className="chat chat-start">
                                <div className="chat-bubble">
                                  <div className="prose prose-sm max-w-none">
                                    {message.answer.split('\n').map((paragraph, index) => (
                                      <p key={index} className="mb-2">
                                        {paragraph}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Question Input */}
                      <div className="space-y-3">
                        {chatError && (
                          <div className="alert alert-error">
                            <span className="text-sm">{chatError}</span>
                          </div>
                        )}
                        
                        <div className="join w-full">
                          <input
                            type="text"
                            placeholder="Zadaj pytanie o ten film..."
                            className="input input-bordered join-item flex-1"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAskQuestion();
                              }
                            }}
                            disabled={isAsking}
                            maxLength={1000}
                          />
                          <button
                            className="btn btn-primary join-item"
                            onClick={handleAskQuestion}
                            disabled={isAsking || !question.trim()}
                          >
                            {isAsking ? (
                              <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                              'Wyślij'
                            )}
                          </button>
                        </div>
                        
                        <div className="text-xs text-base-content/50">
                          {question.length}/1000 znaków
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Transcript Tab */}
            {activeTab === 'transcript' && videoData.transcript && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="card-title">Pełna transkrypcja</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyTranscript}
                        className="btn btn-sm btn-outline"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Kopiuj
                      </button>
                    </div>
                  </div>

                  {formattedTranscript && (
                    <div className="mb-4 stats stats-horizontal">
                      <div className="stat">
                        <div className="stat-title">Słowa</div>
                        <div className="stat-value text-lg">{formattedTranscript.wordCount}</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Czas czytania</div>
                        <div className="stat-value text-lg">{formattedTranscript.estimatedReadTime} min</div>
                      </div>
                      <div className="stat">
                        <div className="stat-title">Paragrafy</div>
                        <div className="stat-value text-lg">{formattedTranscript.paragraphs.length}</div>
                      </div>
                    </div>
                  )}

                  <div className="prose prose-sm max-w-none">
                    {formattedTranscript ? (
                      formattedTranscript.paragraphs.map((paragraph: string, index: number) => (
                        <p key={index} className="mb-4 leading-relaxed">
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p>{videoData.transcript}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}