'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import SearchBar from '@/components/search/SearchBar';
import Header from '@/components/layout/Header';
import { Play, Brain, Sparkles, Users } from 'lucide-react';

export default function HomePage() {
  const { isSignedIn } = useUser();

  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            Extract Knowledge from YouTube
          </h1>
          <p className="text-xl text-base-content/70 mb-8">
            Search, transcribe, and get AI-powered summaries of any YouTube video
          </p>
          
          <div className="max-w-2xl mx-auto">
            <SearchBar />
          </div>
          
          {!isSignedIn && (
            <div className="mt-6">
              <Link href="/sign-in" className="btn btn-primary btn-lg">
                Get Started Free
              </Link>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Play className="w-12 h-12 text-primary mb-4" />
              <h3 className="card-title">Smart Search</h3>
              <p className="text-base-content/70">
                Search YouTube videos with advanced filters for duration, date, and relevance
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Brain className="w-12 h-12 text-secondary mb-4" />
              <h3 className="card-title">AI Summaries</h3>
              <p className="text-base-content/70">
                Get instant AI-generated summaries of video content in multiple formats
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Sparkles className="w-12 h-12 text-accent mb-4" />
              <h3 className="card-title">Auto Transcription</h3>
              <p className="text-base-content/70">
                Automatically fetch and store video transcripts for easy reference
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Users className="w-12 h-12 text-info mb-4" />
              <h3 className="card-title">Personal Library</h3>
              <p className="text-base-content/70">
                Save your favorite videos and build your knowledge library
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          
          <div className="steps steps-vertical lg:steps-horizontal w-full">
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Search Videos</h4>
                <p className="text-sm text-base-content/70">
                  Enter keywords to find relevant YouTube content
                </p>
              </div>
            </div>
            
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Get Transcript</h4>
                <p className="text-sm text-base-content/70">
                  Automatically fetch video transcripts
                </p>
              </div>
            </div>
            
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">AI Summary</h4>
                <p className="text-sm text-base-content/70">
                  Generate concise summaries with key insights
                </p>
              </div>
            </div>
            
            <div className="step step-primary">
              <div className="text-center mt-4">
                <h4 className="font-semibold">Save & Learn</h4>
                <p className="text-sm text-base-content/70">
                  Build your personal knowledge library
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!isSignedIn && (
          <div className="text-center mt-20">
            <div className="card bg-primary text-primary-content">
              <div className="card-body">
                <h2 className="card-title text-2xl justify-center">
                  Ready to unlock YouTube knowledge?
                </h2>
                <p>Join thousands of learners extracting insights from videos</p>
                <div className="card-actions justify-center mt-4">
                  <Link href="/sign-up" className="btn btn-secondary btn-lg">
                    Start Free Today
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
