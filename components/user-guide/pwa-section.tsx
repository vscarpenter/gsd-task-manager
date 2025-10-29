/* eslint-disable react/no-unescaped-entities */
"use client";

import { SmartphoneIcon } from "lucide-react";
import { GuideSection } from "./shared-components";

interface PwaSectionProps {
	expanded: boolean;
	onToggle: () => void;
}

export function PwaSection({ expanded, onToggle }: PwaSectionProps) {
	return (
		<GuideSection
			icon={<SmartphoneIcon className="h-5 w-5" />}
			title="PWA (Progressive Web App) Features"
			expanded={expanded}
			onToggle={onToggle}
		>
			<div className="space-y-4 text-sm">
				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Installing as an App
					</h4>
					<div className="space-y-2 text-foreground-muted">
						<p>
							<strong>Desktop (Chrome/Edge):</strong>
						</p>
						<ol className="list-decimal list-inside space-y-1 ml-2">
							<li>Click the install icon (⊕) in the address bar</li>
							<li>Or: Menu → Install GSD Task Manager</li>
							<li>App opens in its own window (no browser chrome)</li>
						</ol>

						<p className="mt-3">
							<strong>iOS (Safari):</strong>
						</p>
						<ol className="list-decimal list-inside space-y-1 ml-2">
							<li>Tap the Share button</li>
							<li>Scroll down and tap "Add to Home Screen"</li>
							<li>Tap "Add" in the top-right</li>
							<li>Icon appears on your home screen</li>
						</ol>

						<p className="mt-3">
							<strong>Android (Chrome):</strong>
						</p>
						<ol className="list-decimal list-inside space-y-1 ml-2">
							<li>Tap the menu (⋮) → "Add to Home screen"</li>
							<li>Or look for the install prompt at the bottom</li>
							<li>App behaves like a native app</li>
						</ol>
					</div>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">
						Offline Capabilities
					</h4>
					<ul className="space-y-1 text-foreground-muted">
						<li>✅ Works completely offline (no internet required)</li>
						<li>✅ All features available offline</li>
						<li>✅ Data syncs when you reconnect (local-first design)</li>
						<li>✅ Service worker caches app for instant loading</li>
					</ul>
				</div>

				<div>
					<h4 className="font-semibold text-foreground mb-2">PWA Benefits</h4>
					<ul className="space-y-1 text-foreground-muted">
						<li>🚀 Faster loading (cached assets)</li>
						<li>📱 No app store required</li>
						<li>🔔 Browser notifications for due tasks</li>
						<li>🏠 Home screen icon for quick access</li>
						<li>💾 No installation size (runs in browser)</li>
						<li>🔄 Auto-updates when you visit</li>
					</ul>
				</div>
			</div>
		</GuideSection>
	);
}
