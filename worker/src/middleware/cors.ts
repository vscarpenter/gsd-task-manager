// CORS middleware and headers

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  ...corsHeaders,
  ...securityHeaders,
};

// Helper to create JSON response with proper headers
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

// Helper to create error response
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
