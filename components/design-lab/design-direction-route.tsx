"use client";

import type { ReactElement } from "react";
import { useSearchParams } from "next/navigation";

import type { DesignDirectionSlug } from "./design-data";
import { DesignDirectionPrototype } from "./design-direction-prototype";

export function DesignDirectionRoute({ slug }: { slug: DesignDirectionSlug }): ReactElement {
  const searchParams = useSearchParams();
  const initialPreview = searchParams.get("preview") === "mobile" ? "mobile" : "responsive";
  const initialTheme = searchParams.get("theme") === "dark" ? "dark" : "light";
  return <DesignDirectionPrototype slug={slug} initialPreview={initialPreview} initialTheme={initialTheme} />;
}
