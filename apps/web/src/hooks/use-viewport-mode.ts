'use client';

import { useEffect, useState } from 'react';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

function resolveViewportMode(width: number): ViewportMode {
  if (width < 768) {
    return 'mobile';
  }

  if (width < 1200) {
    return 'tablet';
  }

  return 'desktop';
}

export function useViewportMode() {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');

  useEffect(() => {
    const updateViewportMode = () => {
      setViewportMode(resolveViewportMode(window.innerWidth));
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);

    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  return {
    viewportMode,
    isDesktop: viewportMode === 'desktop',
    isTablet: viewportMode === 'tablet',
    isMobile: viewportMode === 'mobile',
  };
}
