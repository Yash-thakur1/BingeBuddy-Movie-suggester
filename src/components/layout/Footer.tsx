import Link from 'next/link';
import Image from 'next/image';
import { Github, Twitter } from 'lucide-react';
import { GENRES } from '@/lib/tmdb';

/**
 * Footer Component
 * Site footer with navigation and credits
 */

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-900 border-t border-dark-800">
      <div className="container mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-white font-display font-bold text-xl mb-4"
            >
              <Image
                src="/images/flixora-logo.png"
                alt="Flixora"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              Flixora
            </Link>
            <p className="text-gray-400 text-sm">
              Discover your next favorite movie with our AI-powered recommendations.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/discover" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Discover
                </Link>
              </li>
              <li>
                <Link href="/recommendations" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Recommendations
                </Link>
              </li>
              <li>
                <Link href="/watchlist" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Watchlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Genres */}
          <div>
            <h4 className="text-white font-semibold mb-4">Top Genres</h4>
            <ul className="space-y-2">
              {GENRES.slice(0, 5).map((genre) => (
                <li key={genre.id}>
                  <Link
                    href={`/discover?genre=${genre.id}`}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {genre.icon} {genre.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  TMDB Attribution
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-dark-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © {currentYear} Flixora. This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
