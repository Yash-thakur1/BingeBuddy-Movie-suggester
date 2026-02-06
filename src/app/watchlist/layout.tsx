import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Watchlist - Saved Movies & TV Shows',
  description:
    'Your personal watchlist of saved movies and TV shows. Keep track of what you want to watch next on BingeBuddy.',
  alternates: {
    canonical: '/watchlist',
  },
  openGraph: {
    title: 'My Watchlist - Saved Movies & TV Shows',
    description: 'Keep track of movies and TV shows you want to watch.',
    url: '/watchlist',
  },
};

export default function WatchlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
