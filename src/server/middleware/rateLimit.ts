/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DDoS attacks
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  // General API rate limit
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests: false,
  },

  // Authentication endpoints (more strict)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: false,
  },

  // Voice transcription (resource-intensive)
  voice: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 voice transcriptions per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Voice transcription limit exceeded, please try again later.',
    skipSuccessfulRequests: false,
  },

  // AI chat endpoints
  chat: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // Limit each IP to 200 chat messages per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Chat limit exceeded, please try again later.',
    skipSuccessfulRequests: false,
  },

  // Admin endpoints (more generous)
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Admin API limit exceeded, please try again later.',
    skipSuccessfulRequests: false,
  },
};

// Create rate limiters
export const apiLimiter = rateLimit(RATE_LIMIT_CONFIG.api);
export const authLimiter = rateLimit(RATE_LIMIT_CONFIG.auth);
export const voiceLimiter = rateLimit(RATE_LIMIT_CONFIG.voice);
export const chatLimiter = rateLimit(RATE_LIMIT_CONFIG.chat);
export const adminLimiter = rateLimit(RATE_LIMIT_CONFIG.admin);

// Custom rate limiter for specific routes
export const createCustomLimiter = (config: Partial<typeof RATE_LIMIT_CONFIG.api>) => {
  return rateLimit({
    ...RATE_LIMIT_CONFIG.api,
    ...config,
  });
};

// IP-based rate limiting with user tracking
export const userAwareRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get user ID from request (if authenticated)
    const userId = (req as any).user?.id;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Use user ID if available, otherwise fall back to IP
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    // In a real implementation, you would use Redis or another store
    // For now, we'll use the standard rate limiter
    const limiter = rateLimit({
      windowMs,
      max: maxRequests,
      keyGenerator: () => key,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Rate limit exceeded for your account/IP.',
    });

    return limiter(req, res, next);
  };
};

// Rate limit by endpoint category
export const endpointCategoryLimiter = (category: keyof typeof RATE_LIMIT_CONFIG) => {
  switch (category) {
    case 'auth':
      return authLimiter;
    case 'voice':
      return voiceLimiter;
    case 'chat':
      return chatLimiter;
    case 'admin':
      return adminLimiter;
    default:
      return apiLimiter;
  }
};

// Rate limit bypass for trusted IPs (e.g., internal services)
export const trustedIPRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
  const clientIP = req.ip || req.socket.remoteAddress || '';

  if (trustedIPs.includes(clientIP)) {
    // Skip rate limiting for trusted IPs
    return next();
  }

  // Apply standard rate limiting
  return apiLimiter(req, res, next);
};

// Rate limit status endpoint
export const getRateLimitStatus = (req: Request) => {
  const rateLimitInfo = {
    remaining: (req as any).rateLimit?.remaining || 'unknown',
    limit: (req as any).rateLimit?.limit || 'unknown',
    resetTime: (req as any).rateLimit?.resetTime || 'unknown',
    current: (req as any).rateLimit?.current || 'unknown',
  };

  return rateLimitInfo;
};

// Export rate limit configuration for documentation
export const rateLimitConfig = RATE_LIMIT_CONFIG;