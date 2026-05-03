"use client";

import { ChevronRightIcon } from "lucide-react";

/**
 * Shared settings row components for iOS-style settings UI
 * Extracted to avoid duplication across settings components
 */

interface SettingsRowProps {
	label: string;
	description?: string;
	/** Optional toggle state — when provided, appends "· on" / "· off" to the description for skim readers and screen readers. */
	state?: boolean;
	children: React.ReactNode;
}

/**
 * Settings row with label, optional description, and inline content
 */
export function SettingsRow({ label, description, state, children }: SettingsRowProps) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground">{label}</p>
				{description && (
					<p className="text-xs text-foreground-muted mt-0.5">
						{description}
						{state !== undefined && (
							<span
								className={state ? "text-foreground" : "text-foreground-muted"}
							>
								{" · "}
								{state ? "on" : "off"}
							</span>
						)}
					</p>
				)}
			</div>
			<div className="flex-shrink-0">{children}</div>
		</div>
	);
}

interface SettingsSelectRowProps {
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (value: string) => void;
}

/**
 * Settings row with dropdown select (iOS-style disclosure)
 */
export function SettingsSelectRow({
	label,
	value,
	options,
	onChange,
}: SettingsSelectRowProps) {
	return (
		<div className="relative">
			<label className="flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px] cursor-pointer">
				<span className="text-sm font-medium text-foreground">{label}</span>
				<div className="flex items-center gap-1">
					<select
						aria-label={label}
						value={options.find((opt) => opt.label === value)?.value || options[0].value}
						onChange={(e) => onChange(e.target.value)}
						className="appearance-none bg-transparent text-sm text-foreground-muted
						           text-right pr-5 cursor-pointer focus:outline-none"
					>
						{options.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
					<ChevronRightIcon className="w-4 h-4 text-foreground-muted/70 absolute right-4" />
				</div>
			</label>
		</div>
	);
}
