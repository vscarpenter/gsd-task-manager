export interface ParsedOAuthRequest {
  code: string | null;
  state: string | null;
}

/**
 * Parse OAuth callback request to extract code and state
 * Handles multiple request formats: JSON POST, form POST (Apple), GET query params (Google)
 */
export async function parseOAuthRequest(request: Request): Promise<ParsedOAuthRequest> {
  const url = new URL(request.url);
  const contentType = request.headers.get('content-type');

  if (request.method === 'POST' && contentType?.includes('application/json')) {
    const body = (await request.json()) as { code?: string; state?: string };
    return {
      code: body.code ?? null,
      state: body.state ?? null,
    };
  }

  if (request.method === 'POST' && contentType?.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    return {
      code: formData.get('code') as string,
      state: formData.get('state') as string,
    };
  }

  // GET request with query params (Google redirect)
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
  };
}
