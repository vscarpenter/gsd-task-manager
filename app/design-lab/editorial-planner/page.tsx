import { Suspense } from "react";

import { DesignDirectionRoute } from "@/components/design-lab/design-direction-route";

export default function EditorialPlannerPage() {
  return <Suspense fallback={<div className="dl-route-loading" role="status">Preparing Editorial Planner…</div>}><DesignDirectionRoute slug="editorial-planner" /></Suspense>;
}
