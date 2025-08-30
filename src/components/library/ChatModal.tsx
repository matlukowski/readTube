'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Eye, ExternalLink, MessageCircle, Send, X, FileText, Copy, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';

interface LibraryVideo {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

interface ChatModalProps {
  video: LibraryVideo;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatModal({ video, isOpen, onClose }: ChatModalProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript' | 'video'>('chat');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  // Default to collapsed on mobile for better UX
  const [videoCollapsed, setVideoCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history and transcript when modal opens
  useEffect(() => {
    const loadData = async () => {
      if (isOpen && video.youtubeId) {
        await Promise.all([loadChatHistory(), loadTranscript()]);
      }
    };
    loadData();
  }, [isOpen, video.youtubeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const loadChatHistory = async () => {
    try {
      const response = await apiGet(`/api/chat-with-video?youtubeId=${video.youtubeId}`);
      if (response.success && response.data) {
        setChatHistory(response.data.chats || []);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadTranscript = async () => {
    setTranscriptLoading(true);
    try {
      const response = await apiGet(`/api/library?youtubeId=${video.youtubeId}`);
      if (response.success && response.data) {
        const videoData = response.data.videos?.[0];
        if (videoData?.transcript) {
          setTranscript(videoData.transcript);
        }
      }
    } catch (error) {
      console.error('Error loading transcript:', error);
    } finally {
      setTranscriptLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || isAsking) return;

    setIsAsking(true);
    setChatError('');

    try {
      const response = await apiPost('/api/chat-with-video', {
        youtubeId: video.youtubeId,
        question: question.trim(),
        language: 'pl'
      });

      if (!response.success) {
        throw new Error(response.error || 'Nie udało się uzyskać odpowiedzi');
      }

      const result = response.data;
      
      // Add new message to chat history
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        question: question.trim(),
        answer: result?.answer || '',
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

  const handleCopyTranscript = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-6xl h-[100vh] sm:h-[95vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 flex-shrink-0 border-b border-base-300">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-bold text-base md:text-lg line-clamp-2 mb-1">{video.title}</h3>
            <p className="text-base-content/70 text-sm truncate">{video.channelName}</p>
          </div>
          <button
            className="btn btn-sm btn-circle btn-ghost flex-shrink-0"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed flex-shrink-0 px-4 md:px-6 py-3 md:py-4 bg-base-100 overflow-x-auto">
          <button 
            className={`tab ${activeTab === 'chat' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Czat z AI
          </button>
          <button 
            className={`tab ${activeTab === 'transcript' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('transcript')}
            disabled={!transcript && !transcriptLoading}
          >
            <FileText className="w-4 h-4 mr-2" />
            Podsumowanie AI
            {!transcript && !transcriptLoading && (
              <span className="badge badge-xs badge-warning ml-2">Brak</span>
            )}
          </button>
          <button 
            className={`tab ${activeTab === 'video' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('video')}
          >
            <Play className="w-4 h-4 mr-2" />
            Oglądaj Video
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Collapsible Video */}
              {!videoCollapsed && (
                <div className="flex-shrink-0 p-4 md:p-6 pb-0">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden max-h-[20vh] md:max-h-[25vh]">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.youtubeId}`}
                      title={video.title}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
              
              {/* Video Toggle */}
              <div className="flex-shrink-0 px-4 md:px-6 py-2">
                <button
                  onClick={() => setVideoCollapsed(!videoCollapsed)}
                  className="btn btn-sm btn-ghost w-full justify-between text-xs"
                >
                  <span>{videoCollapsed ? 'Pokaż video' : 'Ukryj video'}</span>
                  {videoCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Chat History */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 space-y-4 min-h-0">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 mx-auto text-base-content/30 mb-4" />
                    <p className="text-base-content/70 mb-4">
                      Zadaj pierwsze pytanie o ten film! 💬
                    </p>
                    <div className="text-sm text-base-content/50">
                      <p>Przykładowe pytania:</p>
                      <ul className="mt-2 space-y-1 text-left max-w-xs mx-auto">
                        <li>• O czym jest ten film?</li>
                        <li>• Jakie są główne punkty?</li>
                        <li>• Wyjaśnij mi [konkretny fragment]</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    {chatHistory.map((message) => (
                      <div key={message.id} className="space-y-3">
                        {/* Question */}
                        <div className="chat chat-end">
                          <div className="chat-bubble chat-bubble-primary text-sm">
                            {message.question}
                          </div>
                        </div>
                        {/* Answer */}
                        <div className="chat chat-start">
                          <div className="chat-bubble text-sm">
                            <div className="prose prose-sm max-w-none">
                              {message.answer.split('\n').map((paragraph, index) => (
                                <p key={index} className="mb-2 last:mb-0">
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Sticky Chat Input */}
              <div className="flex-shrink-0 bg-base-100 border-t border-base-300 p-4 md:p-6 space-y-3">
                {chatError && (
                  <div className="alert alert-error alert-sm">
                    <span className="text-sm">{chatError}</span>
                  </div>
                )}
                
                <div className="join w-full">
                  <input
                    type="text"
                    placeholder="Zadaj pytanie o ten film..."
                    className="input input-bordered input-sm join-item flex-1"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isAsking || !transcript}
                    maxLength={1000}
                  />
                  <button
                    className="btn btn-primary btn-sm join-item"
                    onClick={handleAskQuestion}
                    disabled={isAsking || !question.trim() || !transcript}
                  >
                    {isAsking ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                {!transcript && (
                  <div className="text-xs text-warning text-center">
                    Brak transkrypcji - nie można zadawać pytań
                  </div>
                )}
                
                <div className="text-xs text-base-content/50 text-center">
                  {question.length}/1000 znaków
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="h-full flex flex-col">
              {transcriptLoading ? (
                <div className="flex justify-center items-center h-full">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : transcript ? (
                <>
                  <div className="flex justify-between items-center p-4 md:p-6 pb-4 flex-shrink-0 border-b border-base-300">
                    <div className="flex items-center gap-2 md:gap-4">
                      <h4 className="font-semibold text-sm md:text-base">Podsumowanie AI</h4>
                      {video.duration && (
                        <div className="hidden sm:flex items-center gap-2 text-sm text-base-content/60">
                          <Clock className="w-4 h-4" />
                          {video.duration}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleCopyTranscript}
                      className="btn btn-sm btn-outline"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Kopiuj</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{transcript}</div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-base-content/30 mb-6" />
                  <h4 className="text-lg font-semibold mb-2">Brak podsumowania</h4>
                  <p className="text-base-content/70">
                    Podsumowanie AI nie jest dostępne dla tego filmu
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'video' && (
            <div className="h-full flex flex-col bg-black">
              <div className="flex-1 flex items-center justify-center p-2 md:p-6">
                <div className="w-full max-w-5xl">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.youtubeId}`}
                      title={video.title}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
              
              {/* Video Info */}
              <div className="flex-shrink-0 bg-base-100 p-4 md:p-6 border-t border-base-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-base-content/60">
                    {video.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {video.duration}
                      </span>
                    )}
                    {video.viewCount && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {video.viewCount}
                      </span>
                    )}
                  </div>
                  <a
                    href={`https://youtube.com/watch?v=${video.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Otwórz w YouTube
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </div>
    </div>
  );
}