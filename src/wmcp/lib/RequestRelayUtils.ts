/**
 * Request Relay Manager
 * 
 * Manages the communication between the main application and the Service Worker
 * for request relay functionality, allowing seamless proxying of WebContainer
 * development servers through custom URLs.
 */

export interface PortMapping {
  port: number;
  url: string;
  appId: string;
}

export interface RelayConfig {
  pattern: string;
  config: {
    cors?: boolean;
    injectScripts?: boolean;
    headers?: Record<string, string>;
  };
}

export class RequestRelayManager {
  private portMappings = new Map<number, string>();
  private isServiceWorkerReady = false;

  constructor() {
    this.initServiceWorker();
  }

  /**
   * Initialize service worker communication
   */
  private async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        this.isServiceWorkerReady = true;
        console.log('RequestRelayManager: Service Worker ready');
      } catch (error) {
        console.error('RequestRelayManager: Service Worker initialization failed:', error);
      }
    } else {
      console.warn('RequestRelayManager: Service Workers not supported');
    }
  }

  /**
   * Update port mapping in the service worker
   */
  updatePortMapping(port: number, url: string, appId?: string) {
    const finalAppId = appId || `app-${port}`;
    this.portMappings.set(port, url);
    this.notifyServiceWorker('updatePorts', {
      ports: [{ port, url, appId: finalAppId }]
    });
    
    console.log(`RequestRelayManager: Updated port mapping ${port} -> ${url}`);
  }

  /**
   * Update multiple port mappings at once
   */
  updatePortMappings(mappings: Array<{ port: number; url: string; appId?: string }>) {
    const ports = mappings.map(({ port, url, appId }) => {
      const finalAppId = appId || `app-${port}`;
      this.portMappings.set(port, url);
      return { port, url, appId: finalAppId };
    });

    this.notifyServiceWorker('updatePorts', { ports });
    console.log(`RequestRelayManager: Updated ${ports.length} port mappings`);
  }

  /**
   * Remove a port mapping
   */
  removePortMapping(port: number) {
    this.portMappings.delete(port);
    this.notifyServiceWorker('updatePorts', {
      ports: Array.from(this.portMappings.entries()).map(([p, url]) => ({
        port: p,
        url,
        appId: `app-${p}`
      }))
    });
    
    console.log(`RequestRelayManager: Removed port mapping for ${port}`);
  }

  /**
   * Generate a proxy URL for a given port and path
   */
  generateProxyUrl(port: number, path: string = ''): string {
    const baseUrl = window.location.origin;
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const hostPort = window.location.port;
    
    // Generate subdomain pattern: app-3000.domain.com
    const subdomain = `app-${port}`;
    const proxyHost = hostPort 
      ? `${subdomain}.${hostname}:${hostPort}`
      : `${subdomain}.${hostname}`;
    
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${protocol}//${proxyHost}${cleanPath}`;
  }

  /**
   * Check if a URL is a proxy URL managed by this system
   */
  isProxyUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const match = urlObj.hostname.match(/^app-(\d+)\.(.+)$/);
      return match !== null;
    } catch {
      return false;
    }
  }

  /**
   * Extract port and original path from a proxy URL
   */
  parseProxyUrl(url: string): { port: number; path: string } | null {
    try {
      const urlObj = new URL(url);
      const match = urlObj.hostname.match(/^app-(\d+)\.(.+)$/);
      
      if (match) {
        const port = parseInt(match[1]);
        const path = urlObj.pathname + urlObj.search + urlObj.hash;
        return { port, path };
      }
    } catch {
      // Invalid URL
    }
    
    return null;
  }

  /**
   * Configure routing patterns for specific behavior
   */
  configureRouting(pattern: string, config: RelayConfig['config']) {
    this.notifyServiceWorker('configureRouting', { pattern, config });
    console.log(`RequestRelayManager: Configured routing for pattern: ${pattern}`);
  }

  /**
   * Get current port mappings
   */
  getPortMappings(): Map<number, string> {
    return new Map(this.portMappings);
  }

  /**
   * Send message to service worker
   */
  private notifyServiceWorker(type: string, data: any) {
    if (!this.isServiceWorkerReady || !navigator.serviceWorker.controller) {
      console.warn(`RequestRelayManager: Service Worker not ready, queuing message: ${type}`);
      // Could implement a queue here for messages to send when SW is ready
      return;
    }

    try {
      navigator.serviceWorker.controller.postMessage({ type, data });
    } catch (error) {
      console.error('RequestRelayManager: Failed to send message to Service Worker:', error);
    }
  }

  /**
   * Wait for service worker to be ready
   */
  async waitForServiceWorker(): Promise<boolean> {
    if (this.isServiceWorkerReady) {
      return true;
    }

    // Wait up to 5 seconds for service worker
    for (let i = 0; i < 50; i++) {
      if (this.isServiceWorkerReady) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }
}

// Export a singleton instance for easy use
export const requestRelayManager = new RequestRelayManager();

// Helper functions for common operations
export const generateProxyUrl = (port: number, path?: string) => 
  requestRelayManager.generateProxyUrl(port, path);

export const updatePortMapping = (port: number, url: string, appId?: string) =>
  requestRelayManager.updatePortMapping(port, url, appId);

export const isProxyUrl = (url: string) => 
  requestRelayManager.isProxyUrl(url);

export const parseProxyUrl = (url: string) => 
  requestRelayManager.parseProxyUrl(url);