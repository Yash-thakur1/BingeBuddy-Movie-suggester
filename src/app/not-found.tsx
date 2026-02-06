import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found. Discover movies and TV shows on BingeBuddy.',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-dark-800 flex items-center justify-center">
          <span className="text-6xl">🎬</span>
        </div>
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-300 mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Looks like this movie got lost in the archives. Let&apos;s get you back to discovering great films.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
          <Link href="/discover">
            <Button variant="secondary">Discover Movies</Button>
          </Link>
        </div>

        {/* Additional crawlable links for recovery */}
        <nav className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/search" className="text-gray-500 hover:text-white transition-colors">Search</Link>
          <Link href="/tv" className="text-gray-500 hover:text-white transition-colors">TV Shows</Link>
          <Link href="/recommendations" className="text-gray-500 hover:text-white transition-colors">Recommendations</Link>
        </nav>
      </div>
    </div>
  );
}
