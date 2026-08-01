import { Suspense } from "react";

import { DesignDirectionRoute } from "@/components/design-lab/design-direction-route";

export default function SpatialFocusPage() {
  return <Suspense fallback={<div className="dl-route-loading" role="status">Preparing Spatial Focus…</div>}><DesignDirectionRoute slug="spatial-focus" /></Suspense>;
}
