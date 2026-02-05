'use client';

import { Heart, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEngagement } from '@/hooks/useEngagement';
import { useAuth } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils';
import type { ReactionType } from '@/lib/firebase/engagement';

// ============================================
// Helpers
// ============================================

/** Compact number format: 1200 → 1.2K */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ============================================
// Sub-components
// ============================================

interface ReactionButtonProps {
  type: ReactionType;
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ReactionButton({ type, count, active, disabled, onClick }: ReactionButtonProps) {
  const isLike = type === 'like';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={isLike ? (active ? 'Remove like' : 'Like') : active ? 'Remove dislike' : 'Dislike'}
      aria-pressed={active}
      className={cn(
        'group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
        'transition-all duration-200 ease-out select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950',
        // idle
        !active && 'bg-dark-800/60 text-gray-400 hover:bg-dark-700 hover:text-white',
        // active like
        active && isLike && 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40',
        // active dislike
        active && !isLike && 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40',
        // disabled
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      {/* Icon with pop animation */}
      <AnimatePresence mode="wait">
        <motion.span
          key={`${type}-${active}`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="flex items-center"
        >
          {isLike ? (
            <Heart
              className={cn(
                'h-[18px] w-[18px] transition-colors',
                active ? 'fill-rose-400 text-rose-400' : 'text-current group-hover:text-rose-400',
              )}
            />
          ) : (
            <ThumbsDown
              className={cn(
                'h-[18px] w-[18px] transition-colors',
                active ? 'fill-sky-400 text-sky-400' : 'text-current group-hover:text-sky-400',
              )}
            />
          )}
        </motion.span>
      </AnimatePresence>

      {/* Live counter with slide-up animation on change */}
      <AnimatePresence mode="wait">
        <motion.span
          key={count}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -6, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="min-w-[1.25rem] tabular-nums text-center"
        >
          {formatCount(count)}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// ============================================
// Main Component
// ============================================

interface EngagementButtonsProps {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  /** Extra Tailwind classes on the wrapper */
  className?: string;
}

export function EngagementButtons({ mediaType, mediaId, className }: EngagementButtonsProps) {
  const { user } = useAuth();
  const { counts, userReaction, isLoading, isToggling, toggle } = useEngagement({
    mediaType,
    mediaId,
    userId: user?.id ?? null,
  });

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {/* skeleton pills */}
        <div className="h-9 w-20 animate-pulse rounded-full bg-dark-800/60" />
        <div className="h-9 w-20 animate-pulse rounded-full bg-dark-800/60" />
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-3', className)}
      role="group"
      aria-label="Engagement reactions"
    >
      <ReactionButton
        type="like"
        count={counts.likes}
        active={userReaction === 'like'}
        disabled={isToggling}
        onClick={() => toggle('like')}
      />
      <ReactionButton
        type="dislike"
        count={counts.dislikes}
        active={userReaction === 'dislike'}
        disabled={isToggling}
        onClick={() => toggle('dislike')}
      />
    </div>
  );
}
