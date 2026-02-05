'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X, Home, Film, Tv, Sparkles, Bookmark, Search, LogIn, UserPlus,
  User, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { useUIStore, useWatchlistStore } from '@/store';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';

/**
 * Full-screen slide-in mobile navigation drawer
 * Slides from the right, supports swipe-to-close gesture
 */

const SWIPE_CLOSE_THRESHOLD = 80;

export function MobileDrawer() {
  const { isMobileMenuOpen, closeMobileMenu, openSearch } = useUIStore();
  const watchlistCount = useWatchlistStore((state) => state.items.length);
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  const isMoviesActive = pathname === '/' || pathname.startsWith('/movies') || pathname.startsWith('/movie/');
  const isTVActive = pathname.startsWith('/tv');

  // Lock body scroll when open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu();
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileMenuOpen, closeMobileMenu]);

  // Close on route change
  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  // Swipe-to-close handler
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x > SWIPE_CLOSE_THRESHOLD) {
        closeMobileMenu();
      }
    },
    [closeMobileMenu]
  );

  const handleLogout = () => {
    closeMobileMenu();
    logout();
  };

  const contentTabs = [
    { href: '/', label: 'Movies', icon: Film, isActive: isMoviesActive },
    { href: '/tv', label: 'TV Series', icon: Tv, isActive: isTVActive },
  ];

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: isTVActive ? '/tv/discover' : '/discover', label: 'Discover', icon: Film },
    { href: isTVActive ? '/tv/recommendations' : '/recommendations', label: 'For You', icon: Sparkles },
    {
      href: '/watchlist',
      label: 'Watchlist',
      icon: Bookmark,
      badge: watchlistCount > 0 ? watchlistCount : undefined,
    },
  ];

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed top-0 right-0 bottom-0 z-50 w-[80vw] max-w-[320px] md:hidden',
              'bg-dark-950 border-l border-dark-800 shadow-2xl',
              'flex flex-col overflow-y-auto overscroll-contain'
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between p-4 border-b border-dark-800">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="flex items-center gap-2 text-white font-display font-bold text-lg"
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
              <button
                onClick={closeMobileMenu}
                className="p-2 text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── User section ── */}
            <div className="p-4 border-b border-dark-800">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link
                    href="/auth/login"
                    onClick={closeMobileMenu}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg',
                      'bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium',
                      'transition-colors'
                    )}
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={closeMobileMenu}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg',
                      'border border-dark-700 hover:bg-dark-800 text-white text-sm font-medium',
                      'transition-colors'
                    )}
                  >
                    <UserPlus className="w-4 h-4" />
                    Sign up
                  </Link>
                </div>
              )}
            </div>

            {/* ── Content type toggle ── */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex bg-dark-800/50 rounded-full p-1">
                {contentTabs.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium',
                      'transition-all duration-200',
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
            </div>

            {/* ── Search shortcut ── */}
            <div className="px-4 py-2">
              <button
                onClick={() => {
                  closeMobileMenu();
                  // Small delay so drawer closes first
                  setTimeout(() => openSearch(), 150);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                  'bg-dark-800/60 text-gray-400 text-sm',
                  'hover:bg-dark-800 transition-colors'
                )}
              >
                <Search className="w-4 h-4" />
                Search movies & TV shows…
              </button>
            </div>

            {/* ── Navigation links ── */}
            <nav className="flex-1 px-4 py-2">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 px-3">Browse</p>
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl mb-0.5',
                      'text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-600/10 text-primary-400'
                        : 'text-gray-300 hover:bg-dark-800 hover:text-white'
                    )}
                  >
                    <link.icon className="w-5 h-5" />
                    {link.label}
                    {link.badge !== undefined && (
                      <span className="ml-auto bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {link.badge > 9 ? '9+' : link.badge}
                      </span>
                    )}
                    {!link.badge && (
                      <ChevronRight className="w-4 h-4 ml-auto text-gray-600" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ── Account section (when authenticated) ── */}
            {user && (
              <div className="px-4 py-2 border-t border-dark-800">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 px-3">Account</p>
                <Link
                  href="/profile"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-300 hover:bg-dark-800 hover:text-white transition-colors"
                >
                  <User className="w-5 h-5" />
                  Profile
                  <ChevronRight className="w-4 h-4 ml-auto text-gray-600" />
                </Link>
                <Link
                  href="/settings"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-300 hover:bg-dark-800 hover:text-white transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  Settings
                  <ChevronRight className="w-4 h-4 ml-auto text-gray-600" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-red-400 hover:bg-dark-800 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            )}

            {/* ── Bottom safe-area spacer ── */}
            <div className="h-6 shrink-0" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
