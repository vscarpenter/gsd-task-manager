import type { ReactNode } from "react";
import { QueryProvider } from "@/components/query-provider";

// react-query serves this route group only, so its provider lives here and
// stays out of the chunks every route downloads.
export default function SyncLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
