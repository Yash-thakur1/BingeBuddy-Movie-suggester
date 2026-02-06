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
import { WebSiteSchema } from '@/components/seo';
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

const SITE_URL = 'https://www.bingebuddy.in';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BingeBuddy - AI Movie & TV Show Recommendations | Discover What to Watch',
    template: '%s | BingeBuddy',
  },
  description:
    'BingeBuddy is your AI-powered movie and TV show recommendation engine. Discover trending films, get personalized suggestions by mood and genre, build your watchlist, and never run out of things to watch.',
  keywords: [
    'movie recommendations',
    'TV show recommendations',
    'what to watch',
    'AI movie suggestions',
    'trending movies 2026',
    'best movies',
    'best TV shows',
    'movie discovery',
    'personalized recommendations',
    'watchlist',
    'movie database',
    'bingebuddy',
    'streaming guide',
    'mood-based recommendations',
  ],
  authors: [{ name: 'Yash Kumar' }],
  creator: 'BingeBuddy',
  publisher: 'BingeBuddy',
  alternates: {
    canonical: SITE_URL,
  },
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
    url: SITE_URL,
    siteName: 'BingeBuddy',
    title: 'BingeBuddy - AI Movie & TV Show Recommendations',
    description:
      'Discover movies and TV shows tailored to your taste. Get AI-powered recommendations by mood, genre, and preferences. Build your watchlist today.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'BingeBuddy - Discover Your Next Favorite Movie',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BingeBuddy - AI Movie & TV Show Recommendations',
    description:
      'Discover movies and TV shows tailored to your taste. AI-powered recommendations by mood, genre, and preferences.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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
        {/* DNS prefetch & preconnect for critical third-party origins */}
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.themoviedb.org" />
        <link rel="preconnect" href="https://api.themoviedb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />

        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-MDRQ6KXD');`}
        </Script>

        {/* WebSite structured data for sitelinks search box */}
        <WebSiteSchema
          url={SITE_URL}
          name="BingeBuddy"
          description="AI-powered movie and TV show recommendation engine. Discover trending films, get personalized suggestions, and build your watchlist."
        />

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
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MDRQ6KXD"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
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
