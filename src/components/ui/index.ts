export { Button } from './Button';
export { Input } from './Input';
export { Badge, RatingBadge } from './Badge';
export { DropdownSelect } from './DropdownSelect';
export type { DropdownOption } from './DropdownSelect';
export {
  Skeleton,
  MovieCardSkeleton,
  MovieGridSkeleton,
  HeroSkeleton,
  CastCardSkeleton,
  MovieDetailsSkeleton,
  SearchResultSkeleton,
} from './Skeleton';

// Error Handling
export {
  ErrorBoundary,
  ErrorFallback,
  OfflineFallback,
  APIErrorFallback,
  EmptyStateFallback,
} from './ErrorBoundary';

// Network Status
export {
  NetworkStatusBanner,
  FreshnessIndicator,
  SmartLoading,
} from './NetworkStatus';

// Animations
export {
  PageTransition,
  FadeIn,
  StaggerChildren,
  StaggerItem,
  ScaleOnHover,
  SlideIn,
  Pulse,
  ShimmerEffect,
  scrollToElement,
  scrollToTop,
} from './Animations';

// Optimized Components
export {
  OptimizedImage,
  PosterImage,
  BackdropImage,
  ProfileImage,
  generateBlurPlaceholder,
  generateShimmerPlaceholder,
} from './OptimizedImage';

export {
  OptimizedLink,
  MovieLink,
  TVShowLink,
  ViewportPrefetchLink,
} from './OptimizedLink';

// Progressive loading
export { LazyRail } from './LazyRail';
