'use client';

/**
 * FeedbackButtons Component
 * 
 * Displays Like/Dislike buttons for movie recommendations.
 * Integrates with the preference learning engine for personalization.
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  FeedbackType, 
  MovieAttributes, 
  loadLearningState, 
  saveLearningState, 
  recordFeedback, 
  getFeedback,
  removeFeedback
} from '@/lib/ai/preferenceLearning';

interface FeedbackButtonsProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  attributes: MovieAttributes;
  referenceMovieId?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
  onFeedbackChange?: (feedback: FeedbackType) => void;
}

export function FeedbackButtons({
  mediaId,
  mediaType,
  attributes,
  referenceMovieId,
  size = 'md',
  showLabels = false,
  className,
  onFeedbackChange
}: FeedbackButtonsProps) {
  // Get initial feedback state
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType>(() => {
    const state = loadLearningState();
    return getFeedback(state, mediaId, mediaType);
  });
  
  const [isAnimating, setIsAnimating] = useState<'like' | 'dislike' | null>(null);
  
  const handleFeedback = useCallback((newFeedback: FeedbackType) => {
    // Load current state
    let state = loadLearningState();
    
    // If clicking the same button, toggle off (neutral)
    const actualFeedback = currentFeedback === newFeedback ? 'neutral' : newFeedback;
    
    // Update state
    if (actualFeedback === 'neutral') {
      state = removeFeedback(state, mediaId, mediaType);
    } else {
      state = recordFeedback(state, attributes, actualFeedback, referenceMovieId);
    }
    
    // Save state
    saveLearningState(state);
    
    // Trigger animation
    if (actualFeedback !== 'neutral') {
      setIsAnimating(actualFeedback as 'like' | 'dislike');
      setTimeout(() => setIsAnimating(null), 300);
    }
    
    // Update local state
    setCurrentFeedback(actualFeedback);
    
    // Callback
    onFeedbackChange?.(actualFeedback);
  }, [currentFeedback, mediaId, mediaType, attributes, referenceMovieId, onFeedbackChange]);
  
  // Size classes
  const sizeClasses = {
    sm: 'h-6 w-6 text-sm',
    md: 'h-8 w-8 text-base',
    lg: 'h-10 w-10 text-lg'
  };
  
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Like Button */}
      <button
        onClick={() => handleFeedback('like')}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200',
          sizeClasses[size],
          currentFeedback === 'like'
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-dark-700/50 text-gray-400 hover:bg-dark-600 hover:text-green-400',
          isAnimating === 'like' && 'scale-125'
        )}
        title="Like this recommendation"
        aria-label="Like"
      >
        <ThumbsUpIcon size={iconSize} filled={currentFeedback === 'like'} />
      </button>
      
      {showLabels && currentFeedback === 'like' && (
        <span className="text-xs text-green-400 ml-1">Liked</span>
      )}
      
      {/* Dislike Button */}
      <button
        onClick={() => handleFeedback('dislike')}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200',
          sizeClasses[size],
          currentFeedback === 'dislike'
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-dark-700/50 text-gray-400 hover:bg-dark-600 hover:text-red-400',
          isAnimating === 'dislike' && 'scale-125'
        )}
        title="Dislike this recommendation"
        aria-label="Dislike"
      >
        <ThumbsDownIcon size={iconSize} filled={currentFeedback === 'dislike'} />
      </button>
      
      {showLabels && currentFeedback === 'dislike' && (
        <span className="text-xs text-red-400 ml-1">Not for me</span>
      )}
    </div>
  );
}

// ============================================
// Icon Components
// ============================================

interface IconProps {
  size?: number;
  filled?: boolean;
  className?: string;
}

function ThumbsUpIcon({ size = 18, filled = false, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownIcon({ size = 18, filled = false, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

// ============================================
// Feedback Summary Component
// ============================================

interface FeedbackSummaryProps {
  className?: string;
}

export function FeedbackSummary({ className }: FeedbackSummaryProps) {
  const [state, setState] = useState(() => loadLearningState());
  
  // Refresh state periodically
  React.useEffect(() => {
    const interval = setInterval(() => {
      setState(loadLearningState());
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const totalFeedback = state.totalLikes + state.totalDislikes;
  
  if (totalFeedback === 0) {
    return null;
  }
  
  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-800/50 text-sm',
      className
    )}>
      <span className="text-gray-400">Your feedback:</span>
      
      <div className="flex items-center gap-1 text-green-400">
        <ThumbsUpIcon size={14} filled />
        <span>{state.totalLikes}</span>
      </div>
      
      <div className="flex items-center gap-1 text-red-400">
        <ThumbsDownIcon size={14} filled />
        <span>{state.totalDislikes}</span>
      </div>
      
      {totalFeedback >= 3 && (
        <span className="text-gray-500 text-xs">
          • Personalizing recommendations
        </span>
      )}
    </div>
  );
}

// ============================================
// Confidence Indicator Component
// ============================================

interface ConfidenceIndicatorProps {
  level: 'exact' | 'high' | 'medium' | 'low' | 'ambiguous';
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceIndicator({
  level,
  label,
  showLabel = true,
  className
}: ConfidenceIndicatorProps) {
  const config = {
    exact: { 
      color: 'text-green-400', 
      bg: 'bg-green-500/10', 
      icon: '✓',
      defaultLabel: 'Matched exactly'
    },
    high: { 
      color: 'text-green-400', 
      bg: 'bg-green-500/10', 
      icon: '✓',
      defaultLabel: 'High confidence match'
    },
    medium: { 
      color: 'text-yellow-400', 
      bg: 'bg-yellow-500/10', 
      icon: '○',
      defaultLabel: 'Moderate confidence'
    },
    low: { 
      color: 'text-orange-400', 
      bg: 'bg-orange-500/10', 
      icon: '?',
      defaultLabel: 'Low confidence match'
    },
    ambiguous: { 
      color: 'text-red-400', 
      bg: 'bg-red-500/10', 
      icon: '?',
      defaultLabel: 'Multiple matches found'
    }
  };
  
  const { color, bg, icon, defaultLabel } = config[level];
  const displayLabel = label || defaultLabel;
  
  // Don't show for exact/high confidence (cleaner UX)
  if (level === 'exact' && !showLabel) {
    return null;
  }
  
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
      bg,
      color,
      className
    )}>
      <span>{icon}</span>
      {showLabel && <span>{displayLabel}</span>}
    </div>
  );
}
