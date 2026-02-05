/**
 * Global Application Store
 * Uses Zustand for lightweight, scalable state management
 * Supports persistent authentication and user-scoped caching
 * with stale-while-revalidate strategy for fast initial load
 */

import { create } from 'zustand';
import { Movie, TVShow, UserPreferences, Mood, Era, RatingPreference, DurationPreference } from '@/types/movie';
import { getCache, setCache, CACHE_KEYS, clearUserCache } from '@/lib/cache';

// ============================================
// Auth Session Helper (localStorage-based)
// ============================================

const AUTH_STORAGE_KEY = 'bingebuddy-auth-session';

interface StoredSession {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  token: string;
  expiresAt: number;
}

function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    const session: StoredSession = JSON.parse(stored);
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    
    return session;
  } catch {}
  
  return null;
}

function getAuthHeaders(): HeadersInit {
  const session = getStoredSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  
  return headers;
}

function getCurrentUserId(): string | null {
  const session = getStoredSession();
  return session?.user?.id || null;
}

// ============================================
// Cached Watchlist Data Types
// ============================================

interface CachedWatchlistItem {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
}

// ============================================
// Watchlist Store with SWR Caching
// ============================================

interface WatchlistState {
  items: Movie[];
  tvItems: TVShow[];
  isLoading: boolean;
  isRevalidating: boolean;
  currentUserId: string | null;
  
  // Actions
  addToWatchlist: (movie: Movie) => Promise<void>;
  removeFromWatchlist: (movieId: number) => Promise<void>;
  isInWatchlist: (movieId: number) => boolean;
  addTVShowToWatchlist: (show: TVShow) => Promise<void>;
  removeTVShowFromWatchlist: (showId: number) => Promise<void>;
  isTVShowInWatchlist: (showId: number) => boolean;
  clearWatchlist: () => void;
  
  // Session management with caching
  setCurrentUser: (userId: string | null) => void;
  loadFromServer: () => Promise<void>;
  loadFromCache: () => boolean;
  updateCache: () => void;
  clearUserData: () => void;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: [],
  tvItems: [],
  isLoading: false,
  isRevalidating: false,
  currentUserId: null,
  
  setCurrentUser: (userId) => set({ currentUserId: userId }),
  
  // Load from cache first (returns true if cache hit)
  loadFromCache: () => {
    const userId = getCurrentUserId();
    if (!userId) return false;
    
    const cached = getCache<CachedWatchlistItem[]>(CACHE_KEYS.WATCHLIST, userId);
    if (!cached) return false;
    
    // Parse cached items into movies and TV shows
    const movies: Movie[] = [];
    const tvShows: TVShow[] = [];
    
    cached.data.forEach((item) => {
      if (item.mediaType === 'movie') {
        movies.push({
          id: item.mediaId,
          title: item.title,
          poster_path: item.posterPath,
          vote_average: item.voteAverage || 0,
          release_date: item.releaseDate || '',
          overview: '',
          backdrop_path: null,
          genre_ids: [],
          original_language: 'en',
          original_title: item.title,
          popularity: 0,
          video: false,
          adult: false,
          vote_count: 0,
        });
      } else {
        tvShows.push({
          id: item.mediaId,
          name: item.title,
          poster_path: item.posterPath,
          vote_average: item.voteAverage || 0,
          first_air_date: item.releaseDate || '',
          overview: '',
          backdrop_path: null,
          genre_ids: [],
          original_language: 'en',
          original_name: item.title,
          origin_country: [],
          popularity: 0,
          vote_count: 0,
        });
      }
    });
    
    set({ items: movies, tvItems: tvShows, currentUserId: userId });
    console.log('[Store] Loaded watchlist from cache', { movies: movies.length, tvShows: tvShows.length, isStale: cached.isStale });
    
    return true;
  },
  
  // Update cache with current state
  updateCache: () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    const { items, tvItems } = get();
    
    const cacheData: CachedWatchlistItem[] = [
      ...items.map((m) => ({
        mediaId: m.id,
        mediaType: 'movie' as const,
        title: m.title,
        posterPath: m.poster_path,
        voteAverage: m.vote_average,
        releaseDate: m.release_date,
      })),
      ...tvItems.map((s) => ({
        mediaId: s.id,
        mediaType: 'tv' as const,
        title: s.name,
        posterPath: s.poster_path,
        voteAverage: s.vote_average,
        releaseDate: s.first_air_date,
      })),
    ];
    
    setCache(CACHE_KEYS.WATCHLIST, cacheData, userId);
  },
  
  addToWatchlist: async (movie) => {
    const exists = get().items.some((m) => m.id === movie.id);
    if (exists) return;
    
    // Optimistic update
    set((state) => ({ items: [...state.items, movie] }));
    get().updateCache();
    
    // Sync to server if authenticated
    const session = getStoredSession();
    if (session?.user) {
      try {
        const res = await fetch('/api/user/watchlist', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            mediaId: movie.id,
            mediaType: 'movie',
            title: movie.title,
            posterPath: movie.poster_path,
            voteAverage: movie.vote_average,
            releaseDate: movie.release_date,
          }),
        });
        
        if (!res.ok) {
          set((state) => ({ items: state.items.filter((m) => m.id !== movie.id) }));
          get().updateCache();
        }
      } catch {
        set((state) => ({ items: state.items.filter((m) => m.id !== movie.id) }));
        get().updateCache();
      }
    }
  },
  
  removeFromWatchlist: async (movieId) => {
    const movie = get().items.find((m) => m.id === movieId);
    if (!movie) return;
    
    // Optimistic update
    set((state) => ({ items: state.items.filter((m) => m.id !== movieId) }));
    get().updateCache();
    
    // Sync to server if authenticated
    const session = getStoredSession();
    if (session?.user) {
      try {
        const res = await fetch(`/api/user/watchlist?mediaId=${movieId}&mediaType=movie`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        
        if (!res.ok) {
          set((state) => ({ items: [...state.items, movie] }));
          get().updateCache();
        }
      } catch {
        set((state) => ({ items: [...state.items, movie] }));
        get().updateCache();
      }
    }
  },
  
  isInWatchlist: (movieId) => get().items.some((m) => m.id === movieId),
  
  addTVShowToWatchlist: async (show) => {
    const exists = get().tvItems.some((s) => s.id === show.id);
    if (exists) return;
    
    // Optimistic update
    set((state) => ({ tvItems: [...state.tvItems, show] }));
    get().updateCache();
    
    // Sync to server if authenticated
    const session = getStoredSession();
    if (session?.user) {
      try {
        const res = await fetch('/api/user/watchlist', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            mediaId: show.id,
            mediaType: 'tv',
            title: show.name,
            posterPath: show.poster_path,
            voteAverage: show.vote_average,
            releaseDate: show.first_air_date,
          }),
        });
        
        if (!res.ok) {
          set((state) => ({ tvItems: state.tvItems.filter((s) => s.id !== show.id) }));
          get().updateCache();
        }
      } catch {
        set((state) => ({ tvItems: state.tvItems.filter((s) => s.id !== show.id) }));
        get().updateCache();
      }
    }
  },
  
  removeTVShowFromWatchlist: async (showId) => {
    const show = get().tvItems.find((s) => s.id === showId);
    if (!show) return;
    
    // Optimistic update
    set((state) => ({ tvItems: state.tvItems.filter((s) => s.id !== showId) }));
    get().updateCache();
    
    // Sync to server if authenticated
    const session = getStoredSession();
    if (session?.user) {
      try {
        const res = await fetch(`/api/user/watchlist?mediaId=${showId}&mediaType=tv`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        
        if (!res.ok) {
          set((state) => ({ tvItems: [...state.tvItems, show] }));
          get().updateCache();
        }
      } catch {
        set((state) => ({ tvItems: [...state.tvItems, show] }));
        get().updateCache();
      }
    }
  },
  
  isTVShowInWatchlist: (showId) => get().tvItems.some((s) => s.id === showId),
  
  clearWatchlist: () => {
    set({ items: [], tvItems: [] });
    get().updateCache();
  },
  
  loadFromServer: async () => {
    const session = getStoredSession();
    if (!session?.user) return;
    
    // If we already have cached data, just revalidate in background
    const hasCachedData = get().items.length > 0 || get().tvItems.length > 0;
    
    if (hasCachedData) {
      set({ isRevalidating: true });
    } else {
      set({ isLoading: true });
    }
    
    try {
      const res = await fetch('/api/user/watchlist', {
        headers: getAuthHeaders(),
      });
      
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      
      const movies: Movie[] = [];
      const tvShows: TVShow[] = [];
      
      data.watchlist.forEach((item: any) => {
        if (item.mediaType === 'movie') {
          movies.push({
            id: item.mediaId,
            title: item.title,
            poster_path: item.posterPath,
            vote_average: item.voteAverage || 0,
            release_date: item.releaseDate || '',
            overview: '',
            backdrop_path: null,
            genre_ids: [],
            original_language: 'en',
            original_title: item.title,
            popularity: 0,
            video: false,
            adult: false,
            vote_count: 0,
          });
        } else {
          tvShows.push({
            id: item.mediaId,
            name: item.title,
            poster_path: item.posterPath,
            vote_average: item.voteAverage || 0,
            first_air_date: item.releaseDate || '',
            overview: '',
            backdrop_path: null,
            genre_ids: [],
            original_language: 'en',
            original_name: item.title,
            origin_country: [],
            popularity: 0,
            vote_count: 0,
          });
        }
      });
      
      set({ 
        items: movies, 
        tvItems: tvShows, 
        isLoading: false, 
        isRevalidating: false,
        currentUserId: session.user.id 
      });
      
      // Update cache with fresh data
      get().updateCache();
      console.log('[Store] Refreshed watchlist from server', { movies: movies.length, tvShows: tvShows.length });
    } catch (error) {
      console.error('Error loading watchlist from server:', error);
      set({ isLoading: false, isRevalidating: false });
    }
  },
  
  clearUserData: () => {
    const userId = get().currentUserId;
    set({ items: [], tvItems: [], currentUserId: null, isLoading: false, isRevalidating: false });
    
    // Clear user-specific cache
    if (userId) {
      clearUserCache(userId);
    }
  },
}));

// ============================================
// Cached Preferences Data Type
// ============================================

interface CachedPreferences {
  genres: number[];
  mood: Mood | null;
  languages: string[];
  era: Era | null;
  ratingPreference: RatingPreference;
  durationPreference: DurationPreference;
}

// ============================================
// User Preferences Store with SWR Caching
// ============================================

interface PreferencesState {
  preferences: UserPreferences;
  isLoading: boolean;
  isRevalidating: boolean;
  currentUserId: string | null;
  
  // Actions
  setGenres: (genres: number[]) => void;
  toggleGenre: (genreId: number) => void;
  setMood: (mood: Mood | null) => void;
  setLanguages: (languages: string[]) => void;
  setEra: (era: Era | null) => void;
  setRatingPreference: (rating: RatingPreference) => void;
  setDurationPreference: (duration: DurationPreference) => void;
  resetPreferences: () => void;
  hasActivePreferences: () => boolean;
  
  // Session management with caching
  setCurrentUser: (userId: string | null) => void;
  loadFromServer: () => Promise<void>;
  loadFromCache: () => boolean;
  updateCache: () => void;
  syncToServer: () => Promise<void>;
  clearUserData: () => void;
}

const defaultPreferences: UserPreferences = {
  genres: [],
  mood: null,
  languages: [],
  era: null,
  ratingPreference: 'any',
  durationPreference: 'any',
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  preferences: { ...defaultPreferences },
  isLoading: false,
  isRevalidating: false,
  currentUserId: null,
  
  setCurrentUser: (userId) => set({ currentUserId: userId }),
  
  // Load from cache first (returns true if cache hit)
  loadFromCache: () => {
    const userId = getCurrentUserId();
    if (!userId) return false;
    
    const cached = getCache<CachedPreferences>(CACHE_KEYS.PREFERENCES, userId);
    if (!cached) return false;
    
    set({
      preferences: {
        genres: cached.data.genres || [],
        mood: cached.data.mood || null,
        languages: cached.data.languages || [],
        era: cached.data.era || null,
        ratingPreference: cached.data.ratingPreference || 'any',
        durationPreference: cached.data.durationPreference || 'any',
      },
      currentUserId: userId,
    });
    
    console.log('[Store] Loaded preferences from cache', { isStale: cached.isStale });
    return true;
  },
  
  // Update cache with current state
  updateCache: () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    const { preferences } = get();
    const cacheData: CachedPreferences = {
      genres: preferences.genres,
      mood: preferences.mood,
      languages: preferences.languages,
      era: preferences.era,
      ratingPreference: preferences.ratingPreference,
      durationPreference: preferences.durationPreference,
    };
    
    setCache(CACHE_KEYS.PREFERENCES, cacheData, userId);
  },
  
  setGenres: (genres) => {
    set((state) => ({ preferences: { ...state.preferences, genres } }));
    get().updateCache();
    get().syncToServer();
  },
  
  toggleGenre: (genreId) => {
    set((state) => {
      const genres = state.preferences.genres.includes(genreId)
        ? state.preferences.genres.filter((id) => id !== genreId)
        : [...state.preferences.genres, genreId];
      return { preferences: { ...state.preferences, genres } };
    });
    get().updateCache();
    get().syncToServer();
  },
  
  setMood: (mood) => {
    set((state) => ({ preferences: { ...state.preferences, mood } }));
    get().updateCache();
    get().syncToServer();
  },
  
  setLanguages: (languages) => {
    set((state) => ({ preferences: { ...state.preferences, languages } }));
    get().updateCache();
    get().syncToServer();
  },
  
  setEra: (era) => {
    set((state) => ({ preferences: { ...state.preferences, era } }));
    get().updateCache();
    get().syncToServer();
  },
  
  setRatingPreference: (ratingPreference) => {
    set((state) => ({ preferences: { ...state.preferences, ratingPreference } }));
    get().updateCache();
    get().syncToServer();
  },
  
  setDurationPreference: (durationPreference) => {
    set((state) => ({ preferences: { ...state.preferences, durationPreference } }));
    get().updateCache();
    get().syncToServer();
  },
  
  resetPreferences: () => {
    set({ preferences: { ...defaultPreferences } });
    get().updateCache();
    get().syncToServer();
  },
  
  hasActivePreferences: () => {
    const { preferences } = get();
    return (
      preferences.genres.length > 0 ||
      preferences.mood !== null ||
      preferences.languages.length > 0 ||
      preferences.era !== null ||
      preferences.ratingPreference !== 'any' ||
      preferences.durationPreference !== 'any'
    );
  },
  
  loadFromServer: async () => {
    const session = getStoredSession();
    if (!session?.user) return;
    
    // If we already have preferences, just revalidate in background
    const hasCachedData = get().preferences.genres.length > 0 || get().preferences.mood !== null;
    
    if (hasCachedData) {
      set({ isRevalidating: true });
    } else {
      set({ isLoading: true });
    }
    
    try {
      const res = await fetch('/api/user/preferences', {
        headers: getAuthHeaders(),
      });
      
      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      const serverPrefs = data.preferences;
      
      set({
        preferences: {
          genres: serverPrefs.favoriteGenres || [],
          mood: serverPrefs.preferredMood || null,
          languages: serverPrefs.preferredLanguages || [],
          era: serverPrefs.preferredEra || null,
          ratingPreference: serverPrefs.ratingPreference || 'any',
          durationPreference: 'any',
        },
        isLoading: false,
        isRevalidating: false,
        currentUserId: session.user.id,
      });
      
      // Update cache with fresh data
      get().updateCache();
      console.log('[Store] Refreshed preferences from server');
    } catch (error) {
      console.error('Error loading preferences from server:', error);
      set({ isLoading: false, isRevalidating: false });
    }
  },
  
  syncToServer: async () => {
    const session = getStoredSession();
    if (!session?.user) return;
    
    const { preferences } = get();
    
    try {
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          favoriteGenres: preferences.genres,
          preferredMood: preferences.mood,
          preferredLanguages: preferences.languages,
          preferredEra: preferences.era,
          ratingPreference: preferences.ratingPreference,
        }),
      });
    } catch (error) {
      console.error('Error syncing preferences to server:', error);
    }
  },
  
  clearUserData: () => {
    set({ preferences: { ...defaultPreferences }, currentUserId: null, isLoading: false, isRevalidating: false });
  },
}));

// ============================================
// UI State Store (non-persisted, shared)
// ============================================

interface UIState {
  isSearchOpen: boolean;
  isTrailerModalOpen: boolean;
  currentTrailerKey: string | null;
  currentTrailerTitle: string;
  isMobileMenuOpen: boolean;
  
  openSearch: () => void;
  closeSearch: () => void;
  openTrailerModal: (key: string, title: string) => void;
  closeTrailerModal: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSearchOpen: false,
  isTrailerModalOpen: false,
  currentTrailerKey: null,
  currentTrailerTitle: '',
  isMobileMenuOpen: false,
  
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  
  openTrailerModal: (key, title) =>
    set({ isTrailerModalOpen: true, currentTrailerKey: key, currentTrailerTitle: title }),
  closeTrailerModal: () =>
    set({ isTrailerModalOpen: false, currentTrailerKey: null, currentTrailerTitle: '' }),
  
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
}));

// ============================================
// Search History Store (session-only)
// ============================================

interface SearchHistoryState {
  recentSearches: string[];
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearHistory: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set) => ({
  recentSearches: [],
  
  addSearch: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    
    set((state) => {
      const filtered = state.recentSearches.filter((s) => s !== trimmed);
      return {
        recentSearches: [trimmed, ...filtered].slice(0, 10),
      };
    });
  },
  
  removeSearch: (query) => {
    set((state) => ({
      recentSearches: state.recentSearches.filter((s) => s !== query),
    }));
  },
  
  clearHistory: () => set({ recentSearches: [] }),
}));

// ============================================
// AI Chat Store
// ============================================

import { 
  ChatMessage, 
  processMessage, 
  createUserMessage, 
  createWelcomeMessage,
  createLoadingMessage,
  createErrorMessage
} from '@/lib/ai';

interface ChatState {
  // State
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  suggestedFollowUps: string[];
  hasInitialized: boolean;
  
  // Actions
  initialize: () => void;
  sendMessage: (content: string) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  clearChat: () => void;
  setSuggestedFollowUps: (suggestions: string[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  suggestedFollowUps: [],
  hasInitialized: false,
  
  initialize: () => {
    const { hasInitialized } = get();
    if (hasInitialized) return;
    
    const welcomeMessage = createWelcomeMessage();
    set({ 
      messages: [welcomeMessage], 
      hasInitialized: true,
      suggestedFollowUps: [
        "What's trending?",
        "I'm feeling adventurous",
        "Show me some comedies"
      ]
    });
  },
  
  sendMessage: async (content: string) => {
    const { isLoading } = get();
    if (isLoading || !content.trim()) return;
    
    // Add user message
    const userMessage = createUserMessage(content);
    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      suggestedFollowUps: []
    }));
    
    try {
      // Process message and get response
      const response = await processMessage(content);
      
      set((state) => ({
        messages: [...state.messages, response.message],
        isLoading: false,
        suggestedFollowUps: response.suggestedFollowUps || []
      }));
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = createErrorMessage(
        'I had trouble finding recommendations. Please try again.'
      );
      
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
        suggestedFollowUps: ["Try again", "What's trending?"]
      }));
    }
  },
  
  openChat: () => {
    const { hasInitialized, initialize } = get();
    if (!hasInitialized) {
      initialize();
    }
    set({ isOpen: true });
  },
  
  closeChat: () => set({ isOpen: false }),
  
  toggleChat: () => {
    const { isOpen, hasInitialized, initialize } = get();
    if (!isOpen && !hasInitialized) {
      initialize();
    }
    set({ isOpen: !isOpen });
  },
  
  clearChat: () => {
    const welcomeMessage = createWelcomeMessage();
    set({ 
      messages: [welcomeMessage],
      suggestedFollowUps: [
        "What's trending?",
        "I'm feeling adventurous", 
        "Show me some comedies"
      ]
    });
  },
  
  setSuggestedFollowUps: (suggestions) => set({ suggestedFollowUps: suggestions })
}));
