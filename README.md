# YouTube Knowledge Search MVP

A powerful web application that allows users to search, transcribe, and get AI-powered summaries of YouTube videos. Built with Next.js 14, TypeScript, and modern web technologies.

## Features

- 🔍 **Smart YouTube Search** - Search videos with advanced filters (duration, upload date, relevance)
- 📝 **Auto Transcription** - Automatically fetch video transcripts
- 🤖 **AI Summaries** - Generate concise summaries using OpenAI GPT-4
- ❤️ **Favorites System** - Save and organize your favorite videos
- 📊 **User Dashboard** - Track search history and statistics
- 🌓 **Dark/Light Mode** - Toggle between themes
- 🔐 **Authentication** - Secure login with Clerk (Google OAuth + Email)
- 💾 **Data Persistence** - PostgreSQL database with Prisma ORM

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React
- **Styling**: Tailwind CSS, DaisyUI
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Authentication**: Clerk
- **State Management**: Zustand
- **AI Integration**: OpenAI API
- **Validation**: Zod

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (via Supabase)
- API Keys for:
  - Clerk (authentication)
  - YouTube Data API v3
  - OpenAI API
  - Supabase

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd youtube_ai_search
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory and add:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=your_postgresql_connection_string
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Configuration

### Clerk Setup

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Enable Google OAuth and/or Email authentication
3. Set up the webhook endpoint: `your-domain.com/api/webhooks/clerk`
4. Add the webhook secret to your environment variables

### YouTube API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials (API Key)
5. Add the API key to your environment variables

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Get the database connection string
4. Add all credentials to your environment variables

### OpenAI Setup

1. Create an account at [openai.com](https://openai.com)
2. Generate an API key
3. Add the key to your environment variables

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── (auth)/         # Authentication pages
│   ├── api/            # API routes
│   ├── dashboard/      # User dashboard
│   ├── search/         # Search page
│   └── results/        # Results page
├── components/         # React components
│   ├── ui/            # UI components
│   ├── search/        # Search components
│   ├── results/       # Results components
│   └── layout/        # Layout components
├── lib/               # Utility functions and configurations
│   ├── prisma.ts      # Prisma client
│   ├── youtube.ts     # YouTube API integration
│   ├── ai.ts          # OpenAI integration
│   └── validations.ts # Zod schemas
├── stores/            # Zustand state stores
└── types/             # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma Studio
- `npx prisma db push` - Push schema changes to database
- `npx prisma generate` - Generate Prisma client

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import the project to Vercel
3. Add all environment variables
4. Deploy

### Important Notes

- Ensure all API keys are kept secure
- Set up proper CORS policies for production
- Configure rate limiting for API endpoints
- Monitor API usage to avoid exceeding quotas

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

For support, please open an issue in the GitHub repository.
