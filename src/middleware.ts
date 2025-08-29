import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define protected API routes that require authentication
const isProtectedApiRoute = createRouteMatcher([
  '/api/search(.*)',
  '/api/transcribe(.*)', 
  '/api/summarize(.*)',
  '/api/transcribe-and-summarize(.*)',
  '/api/user(.*)',
  '/api/library(.*)',
  '/api/chat-with-video(.*)',
  '/api/audio-extract(.*)',
  '/api/audio-proxy(.*)',
  '/api/stripe/checkout(.*)',
])

// Define public API routes that don't require authentication
const isPublicApiRoute = createRouteMatcher([
  '/api/stripe/webhook(.*)',
  '/api/webhooks(.*)',
  '/api/gladia-proxy(.*)',
  '/api/video-details(.*)',
])

// Define protected pages that require authentication
const isProtectedPage = createRouteMatcher([
  '/analyze(.*)',
  '/library(.*)',
  '/results(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  
  // For protected API routes, check authentication but return JSON error
  if (isProtectedApiRoute(req)) {
    if (!userId) {
      // Return JSON error for API routes instead of redirecting
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
  }
  
  // For protected pages, use Clerk's default behavior (redirect to sign-in)
  if (isProtectedPage(req)) {
    await auth.protect()
  }
  
  // Public API routes and other routes pass through
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}