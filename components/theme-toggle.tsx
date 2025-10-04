"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme !== "light";

  if (!mounted) {
    return (
      <Button variant="subtle" aria-label="Toggle theme" className="h-10 w-10 p-0">
        <SunIcon className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="subtle"
      aria-label="Toggle theme"
      className="h-10 w-10 p-0"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </Button>
  );
}
