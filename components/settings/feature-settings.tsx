"use client";

import { Switch } from "@/components/ui/switch";
import { SettingsRow } from "./shared-components";

interface FeatureSettingsProps {
  smartViewsEnabled: boolean;
  onToggleSmartViews: () => void;
}

export function FeatureSettings({
  smartViewsEnabled,
  onToggleSmartViews,
}: FeatureSettingsProps) {
  return (
    <div className="divide-y divide-border">
      <SettingsRow
        label="Smart views"
        description="Show reusable task filters in the matrix and command palette"
        state={smartViewsEnabled}
      >
        <Switch
          id="smart-views-enabled"
          checked={smartViewsEnabled}
          onCheckedChange={onToggleSmartViews}
          aria-label="Enable smart views"
        />
      </SettingsRow>
    </div>
  );
}
