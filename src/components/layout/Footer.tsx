import Link from 'next/link';
import Image from 'next/image';
import { Github, Twitter } from 'lucide-react';

/**
 * Footer Component
 * Compact site footer with crawlable navigation links
 */

const footerLinks = [
  { href: '/discover', label: 'Discover' },
  { href: '/search', label: 'Search' },
  { href: '/tv', label: 'TV Shows' },
  { href: '/recommendations', label: 'For You' },
  { href: '/watchlist', label: 'Watchlist' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-900 border-t border-dark-800">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <div className="flex flex-col items-center gap-3">
          {/* Brand row */}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-white font-display font-semibold text-base"
          >
            <Image
              src="/images/bingebuddy-logo.png"
              alt="BingeBuddy"
              width={24}
              height={24}
              className="w-6 h-6"
            />
            BingeBuddy
          </Link>

          {/* Site-wide navigation links — critical for crawlability */}
          <nav aria-label="Footer navigation" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-500 hover:text-white text-xs transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright + socials */}
          <div className="flex items-center gap-3 text-gray-500 text-xs">
            <span>© {currentYear} BingeBuddy</span>
            <span className="text-dark-700">·</span>
            <span>Powered by TMDB</span>
            <span className="text-dark-700">·</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
