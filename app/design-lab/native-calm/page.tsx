import { Suspense } from "react";

import { DesignDirectionRoute } from "@/components/design-lab/design-direction-route";

export default function NativeCalmPage() {
  return <Suspense fallback={<div className="dl-route-loading" role="status">Preparing Native Calm…</div>}><DesignDirectionRoute slug="native-calm" /></Suspense>;
}
