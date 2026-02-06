import Link from 'next/link';
import Image from 'next/image';
import { Github, Twitter } from 'lucide-react';

/**
 * Footer Component
 * Site footer with branding and credits
 */

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-900 border-t border-dark-800">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <div className="flex flex-col items-center gap-2">
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

          {/* Tagline + copyright + socials in a tight cluster */}
          <p className="text-gray-500 text-xs">
            AI-powered movie recommendations
          </p>

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
