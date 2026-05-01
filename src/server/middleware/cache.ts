/**
 * API Caching Middleware
 * Improves performance by caching API responses
 */

import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';

// Cache configuration
const CACHE_CONFIG = {
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Better performance
  deleteOnExpire: true, // Automatically delete expired keys
};

// Create cache instance
const cache = new NodeCache(CACHE_CONFIG);

// Cache key generator
export const generateCacheKey = (req: Request): string => {
  const { originalUrl, method, query, body } = req;
  const user = (req as any).user;
  const userId = user?.id || 'anonymous';
  
  // Create a unique key based on request details
  const keyParts = [
    method,
    originalUrl,
    JSON.stringify(query),
    JSON.stringify(body),
    userId,
  ];

  return `cache:${Buffer.from(keyParts.join('|')).toString('base64')}`;
};

// Cache middleware
export const cacheMiddleware = (ttl: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated admin requests
    if ((req as any).user?.role === 'admin') {
      return next();
    }

    const cacheKey = generateCacheKey(req);

    // Check if response is cached
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`Cache hit: ${cacheKey}`);
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body: any) {
      // Cache successful responses (status 200-299)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
        cache.set(cacheKey, body, ttl);
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

// Cache invalidation
export const invalidateCache = (pattern: string | RegExp): void => {
  const keys = cache.keys();
  const keysToDelete: string[] = [];

  if (typeof pattern === 'string') {
    // String pattern (prefix match)
    keysToDelete.push(...keys.filter(key => key.startsWith(pattern)));
  } else {
    // Regex pattern
    keysToDelete.push(...keys.filter(key => pattern.test(key)));
  }

  if (keysToDelete.length > 0) {
    console.log(`Invalidating ${keysToDelete.length} cache keys matching pattern: ${pattern}`);
    cache.del(keysToDelete);
  }
};

// Cache invalidation middleware
export const cacheInvalidationMiddleware = (patterns: (string | RegExp)[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Invalidate cache after successful non-GET requests
    if (req.method !== 'GET' && res.statusCode >= 200 && res.statusCode < 300) {
      patterns.forEach(pattern => {
        invalidateCache(pattern);
      });
    }
    next();
  };
};

// Cache statistics
export const getCacheStats = () => {
  const stats = cache.getStats();
  return {
    hits: stats.hits,
    misses: stats.misses,
    keys: stats.keys,
    ksize: stats.ksize,
    vsize: stats.vsize,
    cacheSize: cache.keys().length,
  };
};

// Clear entire cache
export const clearCache = (): void => {
  console.log('Clearing entire cache');
  cache.flushAll();
};

// Cache warming utility
export const warmCache = async (urls: string[], baseUrl: string = ''): Promise<void> => {
  console.log(`Warming cache for ${urls.length} URLs`);
  
  for (const url of urls) {
    const fullUrl = `${baseUrl}${url}`;
    console.log(`Would warm cache for: ${fullUrl}`);
  }
  
  console.log('Cache warming complete');
};

// Cache configuration for specific endpoints
export const ENDPOINT_CACHE_CONFIG: Record<string, number> = {
  // Public endpoints (longer TTL)
  '/api/amenities/list': 600, // 10 minutes
  '/api/amenities/:id': 300, // 5 minutes
  '/api/amenities/:id/slots': 60, // 1 minute (availability changes frequently)
  
  // User-specific endpoints (shorter TTL)
  '/api/bookings/my': 30, // 30 seconds
  '/api/work-orders/my': 30, // 30 seconds
  '/api/chat/history': 10, // 10 seconds
  
  // Admin endpoints (no cache or very short TTL)
  '/api/admin/stats': 5, // 5 seconds
  '/api/admin/users': 5, // 5 seconds
};

// Get TTL for specific endpoint
export const getEndpointTTL = (path: string): number => {
  for (const [pattern, ttl] of Object.entries(ENDPOINT_CACHE_CONFIG)) {
    const regex = new RegExp(`^${pattern.replace(/:\w+/g, '[^/]+')}$`);
    if (regex.test(path)) {
      return ttl;
    }
  }
  
  return CACHE_CONFIG.stdTTL; // Default TTL
};

// Smart cache middleware that uses endpoint-specific TTL
export const smartCacheMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ttl = getEndpointTTL(req.path);
    return cacheMiddleware(ttl)(req, res, next);
  };
};

// Export cache instance for direct use
export { cache };