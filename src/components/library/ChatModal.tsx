'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock, Eye, ExternalLink, MessageCircle, Send, X, FileText, Copy } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'transcript'>('chat');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatError, setChatError] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
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
      <div className="modal-box w-full max-w-6xl max-h-[95vh] overflow-y-auto flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex-1">
            <h3 className="font-bold text-xl line-clamp-2 mb-1">{video.title}</h3>
            <p className="text-base-content/70 mb-2">{video.channelName}</p>
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
              <a
                href={`https://youtube.com/watch?v=${video.youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" />
                Otwórz w YouTube
              </a>
            </div>
          </div>
          <button
            className="btn btn-sm btn-circle btn-ghost flex-shrink-0"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="flex-shrink-0 mb-6">
          <div className="aspect-video bg-black rounded-lg overflow-hidden max-h-[50vh]">
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

        {/* Chat Section */}
        <div className="flex-1 flex flex-col min-h-[40vh]">
          <div className="tabs tabs-boxed mb-4 flex-shrink-0">
            <button 
              className={`tab ${activeTab === 'chat' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Czat z filmem
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
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Chat History */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0">
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

              {/* Question Input */}
              <div className="flex-shrink-0 space-y-3">
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
                  <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h4 className="font-semibold">Pełna transkrypcja</h4>
                    <button
                      onClick={handleCopyTranscript}
                      className="btn btn-sm btn-outline"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Kopiuj
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{transcript}</div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-base-content/30 mb-4" />
                  <p className="text-base-content/70">
                    Transkrypcja nie jest dostępna dla tego filmu
                  </p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
      
      <div className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </div>
    </div>
  );
}