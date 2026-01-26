'use client';

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChatMessage as ChatMessageType, MediaItem, getGenreNames } from '@/lib/ai';
import { getImageUrl } from '@/lib/tmdb/config';
import { cn } from '@/lib/utils';
import { FeedbackButtons } from '@/components/features/FeedbackButtons';
import { extractAttributesFromMovie } from '@/lib/ai/preferenceLearning';

/**
 * Media card displayed inside chat messages
 */
const ChatMediaCard = memo(function ChatMediaCard({ 
  item, 
  referenceMovieId 
}: { 
  item: MediaItem; 
  referenceMovieId?: number;
}) {
  const href = item.type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null;
  const genres = getGenreNames(item.genreIds.slice(0, 2), item.type);
  
  // Get or create attributes for feedback
  const attributes = item.attributes || extractAttributesFromMovie(
    {
      id: item.id,
      title: item.title,
      original_language: item.originalLanguage || 'en',
      genre_ids: item.genreIds,
      release_date: item.releaseDate || undefined,
      vote_average: item.voteAverage,
      popularity: item.popularity || 0
    },
    item.type
  );
  
  return (
    <div className="group flex gap-3 p-2 rounded-xl bg-dark-800/50 hover:bg-dark-700/70 
                 border border-dark-700/30 hover:border-primary-500/30
                 transition-all duration-200">
      {/* Poster - clickable */}
      <Link href={href} className="relative w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-dark-700">
        {item.posterPath ? (
          <Image
            src={getImageUrl(item.posterPath, 'w92')}
            alt={item.title}
            fill
            sizes="64px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
        )}
      </Link>
      
      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <Link href={href}>
          <h4 className="font-medium text-white text-sm truncate group-hover:text-primary-400 transition-colors cursor-pointer">
            {item.title}
          </h4>
        </Link>
        
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          {year && <span>{year}</span>}
          {item.voteAverage > 0 && (
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {item.voteAverage.toFixed(1)}
            </span>
          )}
        </div>
        
        {genres.length > 0 && (
          <p className="text-xs text-gray-500 mt-1 truncate">
            {genres.join(' • ')}
          </p>
        )}
        
        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
          {item.overview || 'No description available.'}
        </p>
        
        {/* Like/Dislike Feedback Buttons */}
        <div className="mt-2 flex items-center justify-between">
          <FeedbackButtons
            mediaId={item.id}
            mediaType={item.type}
            attributes={attributes}
            referenceMovieId={referenceMovieId}
            size="sm"
          />
          <Link 
            href={href}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            View details →
          </Link>
        </div>
      </div>
    </div>
  );
});

/**
 * Media grid for chat messages
 */
function ChatMediaGrid({ media, referenceMovieId }: { media: MediaItem[]; referenceMovieId?: number }) {
  return (
    <div className="mt-3 space-y-2">
      {media.map((item) => (
        <ChatMediaCard 
          key={`${item.type}-${item.id}`} 
          item={item} 
          referenceMovieId={referenceMovieId}
        />
      ))}
    </div>
  );
}

/**
 * Loading dots animation
 */
function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

/**
 * Single chat message component
 */
export const ChatMessage = memo(function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';
  const isLoading = message.metadata?.isLoading;
  
  return (
    <div className={cn(
      "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
      isUser ? "justify-end" : "justify-start"
    )}>
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 
                      flex items-center justify-center flex-shrink-0 shadow-lg">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      
      {/* Message bubble */}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3",
        isUser 
          ? "bg-primary-600 text-white rounded-br-md" 
          : "bg-dark-800/80 text-gray-100 rounded-bl-md border border-dark-700/50"
      )}>
        {isLoading ? (
          <LoadingDots />
        ) : (
          <>
            {/* Message text */}
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>
            
            {/* Media cards */}
            {message.media && message.media.length > 0 && (
              <ChatMediaGrid 
                media={message.media} 
                referenceMovieId={message.metadata?.referenceMovieId as number | undefined}
              />
            )}
          </>
        )}
      </div>
      
      {/* Avatar for user */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
});

export default ChatMessage;
