import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { Header, Footer } from '@/components/layout';
import { TrailerModal } from '@/components/movies';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { WatchlistSyncProvider } from '@/components/providers/WatchlistSyncProvider';
import { PerformanceProvider } from '@/components/providers/PerformanceProvider';
import { NetworkStatusBanner } from '@/components/ui';
import { ChatButton, ChatWindow } from '@/components/chat';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: {
    default: 'BingeBuddy - Discover Your Next Favorite Movie',
    template: '%s | BingeBuddy',
  },
  description:
    'Discover movies tailored to your taste with our AI-powered recommendation engine. Browse trending, popular, and critically acclaimed films.',
  keywords: [
    'movies',
    'bingebuddy',
    'movie recommendations',
    'film discovery',
    'movie database',
    'trending movies',
    'watch movies',
  ],
  authors: [{ name: 'Yash Kumar' }],
  creator: 'BingeBuddy',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://flixora-movie-suggester.vercel.app',
    siteName: 'BingeBuddy',
    title: 'BingeBuddy - Discover Your Next Favorite Movie',
    description:
      'Discover movies tailored to your taste with our AI-powered recommendation engine.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'BingeBuddy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BingeBuddy - Discover Your Next Favorite Movie',
    description:
      'Discover movies tailored to your taste with our AI-powered recommendation engine.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0e10',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} dark`}>
      <body className="min-h-screen bg-dark-950">
        <PerformanceProvider>
          <AuthProvider>
            <WatchlistSyncProvider>
              {/* Network Status Banner */}
              <NetworkStatusBanner />
              
              {/* Header */}
              <Header />

              {/* Main content */}
              <main className="min-h-screen pt-16 md:pt-20">{children}</main>

              {/* Footer */}
              <Footer />

              {/* Global modals */}
              <TrailerModal />
              
              {/* AI Chat Assistant */}
              <ChatButton />
              <ChatWindow />
            </WatchlistSyncProvider>
          </AuthProvider>
        </PerformanceProvider>
      </body>
    </html>
  );
}
