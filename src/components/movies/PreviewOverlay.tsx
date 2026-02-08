'use client';

import { useUIStore } from '@/store';
import { Movie, TVShow } from '@/types/movie';
import { HoverPreview } from './HoverPreview';
import { MobileLongPressPreview } from './MobileLongPressPreview';

/**
 * Global singleton preview overlay.
 * Renders one HoverPreview (desktop) or MobileLongPressPreview (mobile)
 * based on the current `useUIStore.previewMode`.
 *
 * Mounted once in the root layout — cards only dispatch to the store.
 */
export function PreviewOverlay() {
  const previewItem = useUIStore((s) => s.previewItem);
  const previewIsTV = useUIStore((s) => s.previewIsTV);
  const previewAnchorRect = useUIStore((s) => s.previewAnchorRect);
  const previewMode = useUIStore((s) => s.previewMode);
  const closePreview = useUIStore((s) => s.closePreview);

  if (!previewItem || !previewMode) return null;

  const movie = previewIsTV ? undefined : (previewItem as Movie);
  const tvShow = previewIsTV ? (previewItem as TVShow) : undefined;

  if (previewMode === 'hover' && previewAnchorRect) {
    return (
      <HoverPreview
        movie={movie}
        tvShow={tvShow}
        anchorRect={previewAnchorRect}
        onClose={closePreview}
      />
    );
  }

  if (previewMode === 'longpress') {
    return (
      <MobileLongPressPreview
        movie={movie}
        tvShow={tvShow}
        isOpen={true}
        onClose={closePreview}
      />
    );
  }

  return null;
}
