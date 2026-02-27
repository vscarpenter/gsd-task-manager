"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { createLogger } from "@/lib/logger";

const logger = createLogger('OAUTH');

interface SupabaseOAuthButtonsProps {
  onError?: (error: Error) => void;
  onStart?: (provider: "google" | "apple") => void;
}

export function SupabaseOAuthButtons({ onError, onStart }: SupabaseOAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(provider);
    onStart?.(provider);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      }
      const supabase = getSupabaseClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      logger.info('OAuth flow initiated', { provider });
      // Supabase handles the redirect — loading state clears on page reload
    } catch (err) {
      setLoading(null);
      const error = err instanceof Error ? err : new Error('OAuth failed');
      logger.error('OAuth flow failed', error, { provider });
      onError?.(error);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="subtle"
        className="relative w-full justify-start"
        disabled={loading !== null}
        onClick={() => handleOAuth("google")}
      >
        {loading === "google" ? "Connecting..." : "Continue with Google"}
      </Button>

      <Button
        variant="subtle"
        className="relative w-full justify-start"
        disabled={loading !== null}
        onClick={() => handleOAuth("apple")}
      >
        {loading === "apple" ? "Connecting..." : "Continue with Apple"}
      </Button>
    </div>
  );
}
