import { NextRequest, NextResponse } from 'next/server';

// Simple proxy endpoint for YouTube requests from client
// This helps avoid CORS issues when fetching YouTube pages from the browser
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }
    
    // Only allow YouTube URLs
    if (!url.startsWith('https://www.youtube.com/')) {
      return NextResponse.json({ error: 'Only YouTube URLs are allowed' }, { status: 400 });
    }
    
    // Forward the request to YouTube
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3',
      }
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `YouTube returned ${response.status}` },
        { status: response.status }
      );
    }
    
    const text = await response.text();
    
    // Return with CORS headers
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    );
  }
}