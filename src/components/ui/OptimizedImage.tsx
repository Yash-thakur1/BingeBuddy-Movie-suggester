/**
 * Optimized Image Component
 * 
 * Features:
 * - Low Quality Image Placeholders (LQIP)
 * - Fixed dimensions to prevent layout shift
 * - Network-aware quality selection
 * - Native browser lazy loading (loading="lazy")
 * - Blur-up animation effect
 * - Priority loading for above-fold images
 */

'use client';

import { useState, useRef, memo } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

// ============================================
// LQIP Generation
// ============================================

/**
 * Generate a tiny SVG placeholder with blur
 */
export function generateBlurPlaceholder(
  width: number,
  height: number,
  color: string = '#1a1a2e'
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <filter id="blur" filterUnits="userSpaceOnUse">
        <feGaussianBlur stdDeviation="20" />
      </filter>
      <rect width="${width}" height="${height}" fill="${color}" filter="url(#blur)" />
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate shimmer placeholder
 */
export function generateShimmerPlaceholder(
  width: number,
  height: number
): string {
  const shimmerColor = '#2a2a3e';
  const highlightColor = '#3a3a4e';
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${shimmerColor}">
            <animate attributeName="offset" values="-2; 1" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" style="stop-color:${highlightColor}">
            <animate attributeName="offset" values="-1; 2" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" style="stop-color:${shimmerColor}">
            <animate attributeName="offset" values="0; 3" dur="1.5s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shimmer)" />
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Pre-generated placeholders for common sizes
const placeholderCache = new Map<string, string>();

function getCachedPlaceholder(width: number, height: number, type: 'blur' | 'shimmer' = 'blur'): string {
  const key = `${type}:${width}:${height}`;
  
  if (!placeholderCache.has(key)) {
    const placeholder = type === 'shimmer'
      ? generateShimmerPlaceholder(width, height)
      : generateBlurPlaceholder(width, height);
    placeholderCache.set(key, placeholder);
  }
  
  return placeholderCache.get(key)!;
}

// ============================================
// Image Quality
// ============================================

type ImageQuality = 'low' | 'medium' | 'high' | 'auto';

function getOptimalQuality(priority: boolean): number {
  return priority ? 85 : 75;
}

function getOptimalSize(
  originalSize: string,
  priority: boolean
): string {
  return originalSize;
}

// ============================================
// Optimized Image Component
// ============================================

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder' | 'blurDataURL'> {
  /** Use shimmer placeholder instead of blur */
  shimmer?: boolean;
  /** Force specific quality regardless of network */
  forceQuality?: number;
  /** Callback when image loads */
  onImageLoad?: () => void;
  /** Enable blur-up animation */
  blurUp?: boolean;
  /** Aspect ratio for container */
  aspectRatio?: string;
  /** Background color for placeholder */
  bgColor?: string;
}

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  shimmer = false,
  forceQuality,
  onImageLoad,
  blurUp = true,
  aspectRatio,
  bgColor = '#1a1a2e',
  className,
  sizes,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  
  // Get numeric dimensions
  const numWidth = typeof width === 'number' ? width : parseInt(String(width), 10) || 300;
  const numHeight = typeof height === 'number' ? height : parseInt(String(height), 10) || 450;
  
  // Get placeholder
  const placeholder = shimmer
    ? getCachedPlaceholder(numWidth, numHeight, 'shimmer')
    : getCachedPlaceholder(numWidth, numHeight, 'blur');
  
  // Get optimal quality
  const quality = forceQuality ?? getOptimalQuality(priority);
  
  // Get optimal sizes
  const optimizedSizes = sizes ? getOptimalSize(sizes, priority) : undefined;
  
  const handleLoad = () => {
    setIsLoaded(true);
    onImageLoad?.();
  };
  
  const handleError = () => {
    setImgError(true);
    setIsLoaded(true);
    onImageLoad?.();
  };
  
  // Container style for fixed dimensions
  const containerStyle = aspectRatio
    ? { aspectRatio }
    : { paddingBottom: `${(numHeight / numWidth) * 100}%` };
  
  return (
    <div
      ref={imgRef}
      className={cn(
        'relative overflow-hidden',
        !aspectRatio && 'h-0',
        className
      )}
      style={containerStyle}
    >
      {/* Background placeholder */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: bgColor }}
      />
      
      {/* Always render <Image> — rely on native loading="lazy" */}
      <Image
        src={imgError ? '/fallback-poster.png' : src}
        alt={alt}
        width={width}
        height={height}
        quality={quality}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        placeholder="blur"
        blurDataURL={placeholder}
        sizes={optimizedSizes}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'absolute inset-0 w-full h-full object-cover',
          blurUp && 'transition-all duration-500',
          blurUp && !isLoaded && 'scale-110 blur-lg',
          blurUp && isLoaded && 'scale-100 blur-0'
        )}
        {...props}
      />
    </div>
  );
});

// ============================================
// Poster Image (Movie/TV Show posters)
// ============================================

interface PosterImageProps {
  src: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  priority?: boolean;
  className?: string;
  onLoad?: () => void;
}

const posterSizes = {
  sm: { width: 92, height: 138, tmdbSize: 'w92' },
  md: { width: 185, height: 278, tmdbSize: 'w185' },
  lg: { width: 342, height: 513, tmdbSize: 'w342' },
  xl: { width: 500, height: 750, tmdbSize: 'w500' },
};

export const PosterImage = memo(function PosterImage({
  src,
  alt,
  size = 'lg',
  priority = false,
  className,
  onLoad,
}: PosterImageProps) {
  const config = posterSizes[size];
  
  const imageSrc = src
    ? `https://image.tmdb.org/t/p/${config.tmdbSize}${src}`
    : '/placeholder-poster.svg';
  
  return (
    <OptimizedImage
      src={imageSrc}
      alt={alt}
      width={config.width}
      height={config.height}
      priority={priority}
      className={cn('rounded-lg', className)}
      sizes={`(max-width: 640px) ${config.width / 2}px, ${config.width}px`}
      onImageLoad={onLoad}
    />
  );
});

// ============================================
// Backdrop Image (Hero backgrounds)
// ============================================

interface BackdropImageProps {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  overlay?: boolean;
  onLoad?: () => void;
}

export const BackdropImage = memo(function BackdropImage({
  src,
  alt,
  priority = false,
  className,
  overlay = true,
  onLoad,
}: BackdropImageProps) {
  const tmdbSize = 'w1280';
  
  const imageSrc = src
    ? `https://image.tmdb.org/t/p/${tmdbSize}${src}`
    : '/placeholder-backdrop.svg';
  
  return (
    <div className={cn('relative', className)}>
      <OptimizedImage
        src={imageSrc}
        alt={alt}
        width={1280}
        height={720}
        priority={priority}
        className="w-full h-full object-cover"
        sizes="100vw"
        forceQuality={75}
        onImageLoad={onLoad}
      />
      
      {overlay && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-dark-950/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-transparent to-transparent" />
        </>
      )}
    </div>
  );
});

// ============================================
// Profile Image (Cast/Crew)
// ============================================

interface ProfileImageProps {
  src: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const profileSizes = {
  sm: { width: 45, height: 45, tmdbSize: 'w45' },
  md: { width: 92, height: 92, tmdbSize: 'w92' },
  lg: { width: 185, height: 185, tmdbSize: 'w185' },
};

export const ProfileImage = memo(function ProfileImage({
  src,
  alt,
  size = 'md',
  className,
}: ProfileImageProps) {
  const config = profileSizes[size];
  
  const imageSrc = src
    ? `https://image.tmdb.org/t/p/${config.tmdbSize}${src}`
    : '/placeholder-profile.svg';
  
  return (
    <OptimizedImage
      src={imageSrc}
      alt={alt}
      width={config.width}
      height={config.height}
      className={cn('rounded-full', className)}
      sizes={`${config.width}px`}
      shimmer
    />
  );
});

export default OptimizedImage;
