'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Search, Bookmark, Sparkles, Home, Film, Tv } from 'lucide-react';
import { SearchBar, MobileSearchOverlay } from './SearchBar';
import { UserMenu } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';
import { useUIStore, useWatchlistStore } from '@/store';
import { cn } from '@/lib/utils';

/**
 * Main Header Component
 * Sticky navigation with search and mobile menu
 */

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, openSearch } = useUIStore();
  const watchlistCount = useWatchlistStore((state) => state.items.length);
  const pathname = usePathname();

  // Determine active content type from pathname
  const isMoviesActive = pathname === '/' || pathname.startsWith('/movies') || pathname.startsWith('/movie/');
  const isTVActive = pathname.startsWith('/tv');

  // Handle scroll for background blur
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/discover', label: 'Discover', icon: Film },
    { href: '/recommendations', label: 'For You', icon: Sparkles },
    { href: '/watchlist', label: 'Watchlist', icon: Bookmark, badge: watchlistCount },
  ];

  // Content type tabs (Movies vs TV)
  const contentTabs = [
    { href: '/', label: 'Movies', icon: Film, isActive: isMoviesActive },
    { href: '/tv', label: 'TV Series', icon: Tv, isActive: isTVActive },
  ];

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          isScrolled
            ? 'bg-dark-950/90 backdrop-blur-md border-b border-dark-800'
            : 'bg-transparent'
        )}
      >
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-white font-display font-bold text-xl md:text-2xl"
            >
              <Image
                src="/images/bingebuddy-logo.png"
                alt="BingeBuddy"
                width={40}
                height={40}
                className="w-8 h-8 md:w-10 md:h-10"
              />
              <span className="hidden sm:inline">BingeBuddy</span>
            </Link>

            {/* Content Type Tabs (Movies / TV Series) */}
            <div className="hidden md:flex items-center bg-dark-800/50 rounded-full p-1 ml-4">
              {contentTabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    'flex items-center gap-2',
                    tab.isActive
                      ? 'bg-primary-600 text-white shadow-glow'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              ))}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-auto mr-4">
              {navLinks.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={isTVActive && link.href === '/discover' ? '/tv/discover' : 
                        isTVActive && link.href === '/recommendations' ? '/tv/recommendations' : link.href}
                  className={cn(
                    'relative px-4 py-2 rounded-lg text-gray-300',
                    'hover:text-white hover:bg-dark-800 transition-colors',
                    'flex items-center gap-2'
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  {link.badge !== undefined && link.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Search (Desktop) */}
            <div className="hidden lg:block w-80">
              <SearchBar />
            </div>

            {/* User Menu (Desktop) */}
            <div className="hidden md:block ml-4">
              <UserMenu />
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Search button (Mobile/Tablet) */}
              <button
                onClick={openSearch}
                className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Watchlist (Mobile) */}
              <Link
                href="/watchlist"
                className="relative md:hidden p-2 text-gray-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              >
                <Bookmark className="w-5 h-5" />
                {watchlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                    {watchlistCount > 9 ? '9+' : watchlistCount}
                  </span>
                )}
              </Link>

              {/* Mobile menu button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <MobileDrawer />

      {/* Mobile Search Overlay */}
      <MobileSearchOverlay />
    </>
  );
}
