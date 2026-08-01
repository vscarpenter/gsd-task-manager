import { Suspense } from "react";

import { DesignDirectionRoute } from "@/components/design-lab/design-direction-route";

export default function PrecisionUtilityPage() {
  return <Suspense fallback={<div className="dl-route-loading" role="status">Preparing Precision Utility…</div>}><DesignDirectionRoute slug="precision-utility" /></Suspense>;
}
