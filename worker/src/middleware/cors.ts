// CORS middleware and headers

import { ALLOWED_ORIGINS, isOriginAllowed } from '../config';

// Get CORS headers based on request origin
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // Check if origin is in allowed list
  let allowedOrigin = ALLOWED_ORIGINS[0]; // Default to production

  if (origin && isOriginAllowed(origin)) {
    allowedOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Legacy export for backwards compatibility
export const corsHeaders = getCorsHeaders();

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// Helper to create JSON response with proper headers
export function jsonResponse(data: any, status = 200, origin?: string | null): Response {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');

  // Add CORS headers (dynamic based on origin)
  const cors = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }

  // Add security headers
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

// Helper to create error response
export function errorResponse(message: string, status = 400, origin?: string | null): Response {
  return jsonResponse({ error: message }, status, origin);
}

// Helper to create CORS headers
export function createCorsHeaders(origin?: string | null): Headers {
  const headers = new Headers();
  const cors = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return headers;
}
