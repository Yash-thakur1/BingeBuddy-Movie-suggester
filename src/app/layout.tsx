import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, Outfit } from 'next/font/google';
import { Header, Footer } from '@/components/layout';
import { TrailerModal } from '@/components/movies';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { WatchlistSyncProvider } from '@/components/providers/WatchlistSyncProvider';
import { PerformanceProvider } from '@/components/providers/PerformanceProvider';
import { NetworkStatusBanner } from '@/components/ui';
import { LazyChat } from '@/components/chat';
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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
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
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GR9WJ24V6Y"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GR9WJ24V6Y');
          `}
        </Script>
      </head>
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
              
              {/* AI Chat Assistant (lazy-loaded) */}
              <LazyChat />
            </WatchlistSyncProvider>
          </AuthProvider>
        </PerformanceProvider>
      </body>
    </html>
  );
}
