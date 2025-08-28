import { NextResponse, NextRequest } from 'next/server'

// Define protected API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/search',
  '/api/transcribe',
  '/api/summarize',
  '/api/transcribe-and-summarize',
  '/api/user',
]

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Only check authentication for protected API routes
  if (isProtectedRoute(pathname)) {
    // Check for access token in various locations
    let accessToken: string | null = null
    
    // Method 1: Authorization header
    const authHeader = request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }
    
    // Method 2: Query parameter (for debugging/development)
    if (!accessToken) {
      accessToken = request.nextUrl.searchParams.get('access_token')
    }
    
    // If no token found, return unauthorized
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - No access token provided' },
        { status: 401 }
      )
    }
    
    // Validate token with Google (basic check)
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
      )
      
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid access token' },
          { status: 401 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized - Token validation failed' },
        { status: 401 }
      )
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}