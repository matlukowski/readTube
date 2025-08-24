import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReadTube - Analizuj filmy YouTube z AI",
  description: "ReadTube - Zamieniaj filmy YouTube w zwięzłe podsumowania AI. Analizuj, transkrybuj i zapisuj najważniejsze treści w swojej bibliotece.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  
  if (!googleClientId) {
    console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
  }
  
  return (
    <html lang="en" data-theme="dark">
      <body className={inter.className}>
        <GoogleOAuthProvider clientId={googleClientId || ''}>
          <AuthProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
