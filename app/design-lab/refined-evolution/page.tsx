import { Suspense } from "react";

import { DesignDirectionRoute } from "@/components/design-lab/design-direction-route";

export default function RefinedEvolutionPage() {
  return <Suspense fallback={<div className="dl-route-loading" role="status">Preparing Refined Evolution…</div>}><DesignDirectionRoute slug="refined-evolution" /></Suspense>;
}
