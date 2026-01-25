/**
 * Network Status & Offline Support
 * 
 * Features:
 * - Detect online/offline status
 * - Detect slow network conditions
 * - Provide hooks for network-aware components
 * - Manage offline mode behaviors
 */

import { create } from 'zustand';

export type NetworkStatus = 'online' | 'offline' | 'slow';
export type ConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

interface NetworkState {
  status: NetworkStatus;
  connectionType: ConnectionType;
  effectiveType: string;
  downlink: number; // Mbps
  rtt: number; // Round trip time in ms
  isOffline: boolean;
  isSlowConnection: boolean;
  lastOnlineTime: number | null;
  
  // Actions
  setStatus: (status: NetworkStatus) => void;
  updateConnectionInfo: (info: Partial<NetworkState>) => void;
  markOnline: () => void;
  markOffline: () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  status: 'online',
  connectionType: 'unknown',
  effectiveType: '4g',
  downlink: 10,
  rtt: 50,
  isOffline: false,
  isSlowConnection: false,
  lastOnlineTime: null,
  
  setStatus: (status) => set({ 
    status,
    isOffline: status === 'offline',
    isSlowConnection: status === 'slow',
  }),
  
  updateConnectionInfo: (info) => set((state) => ({ ...state, ...info })),
  
  markOnline: () => set({ 
    status: 'online', 
    isOffline: false, 
    lastOnlineTime: Date.now() 
  }),
  
  markOffline: () => set({ 
    status: 'offline', 
    isOffline: true 
  }),
}));

/**
 * Initialize network monitoring
 * Call this once in the app root
 */
export function initNetworkMonitoring(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const { setStatus, updateConnectionInfo, markOnline, markOffline } = useNetworkStore.getState();
  
  // Set initial status
  if (!navigator.onLine) {
    markOffline();
  }
  
  // Monitor online/offline events
  const handleOnline = () => {
    console.log('[Network] Back online');
    markOnline();
  };
  
  const handleOffline = () => {
    console.log('[Network] Gone offline');
    markOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Monitor connection quality (if supported)
  const connection = (navigator as any).connection || 
    (navigator as any).mozConnection || 
    (navigator as any).webkitConnection;
  
  const updateConnection = () => {
    if (!connection) return;
    
    const effectiveType = connection.effectiveType || '4g';
    const downlink = connection.downlink || 10;
    const rtt = connection.rtt || 50;
    
    // Determine if connection is slow
    const isSlowConnection = 
      effectiveType === 'slow-2g' || 
      effectiveType === '2g' || 
      downlink < 1.5 || 
      rtt > 500;
    
    updateConnectionInfo({
      connectionType: effectiveType as ConnectionType,
      effectiveType,
      downlink,
      rtt,
      isSlowConnection,
    });
    
    if (isSlowConnection && navigator.onLine) {
      setStatus('slow');
      console.log('[Network] Slow connection detected');
    } else if (navigator.onLine) {
      setStatus('online');
    }
  };
  
  if (connection) {
    connection.addEventListener('change', updateConnection);
    updateConnection();
  }
  
  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (connection) {
      connection.removeEventListener('change', updateConnection);
    }
  };
}

/**
 * Check if a feature should be enabled based on network status
 */
export function shouldEnableFeature(feature: 'trailers' | 'highResImages' | 'prefetch'): boolean {
  const { isOffline, isSlowConnection } = useNetworkStore.getState();
  
  if (isOffline) return false;
  
  switch (feature) {
    case 'trailers':
      return !isSlowConnection;
    case 'highResImages':
      return !isSlowConnection;
    case 'prefetch':
      return !isSlowConnection && !isOffline;
    default:
      return true;
  }
}

/**
 * Get appropriate image size based on network conditions
 */
export function getOptimalImageSize(
  defaultSize: 'w185' | 'w342' | 'w500' | 'w780' | 'original'
): string {
  const { isSlowConnection } = useNetworkStore.getState();
  
  if (!isSlowConnection) return defaultSize;
  
  // Downgrade image size for slow connections
  const sizeMap: Record<string, string> = {
    'original': 'w780',
    'w780': 'w500',
    'w500': 'w342',
    'w342': 'w185',
    'w185': 'w185',
  };
  
  return sizeMap[defaultSize] || defaultSize;
}

/**
 * Format time since last online
 */
export function formatOfflineDuration(): string {
  const { lastOnlineTime } = useNetworkStore.getState();
  
  if (!lastOnlineTime) return 'Unknown';
  
  const now = Date.now();
  const diff = now - lastOnlineTime;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}
