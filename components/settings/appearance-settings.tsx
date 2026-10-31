"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import {
	DEFAULT_ESCALATION_WINDOW_DAYS,
	ESCALATION_WINDOW_OPTIONS,
	readEscalationWindow,
	subscribeEscalationWindow,
	writeEscalationWindow,
	type EscalationWindow,
} from "@/lib/preferences/escalation-window";
import { SettingsRow } from "./shared-components";

const WINDOW_LABELS: Record<string, string> = {
	off: "Off",
	"1": "1 day",
	"2": "2 days",
	"3": "3 days",
	"7": "1 week",
};

const windowValue = (days: EscalationWindow) => (days === null ? "off" : String(days));

function EscalationWindowRow() {
	const days = useSyncExternalStore<EscalationWindow>(
		subscribeEscalationWindow,
		readEscalationWindow,
		() => DEFAULT_ESCALATION_WINDOW_DAYS,
	);
	return (
		<SettingsRow
			label="Escalate tasks due within"
			description="Flags tasks that aren't marked urgent when their due date gets this close. Nothing moves until you say so."
		>
			<select
				aria-label="Escalate tasks due within"
				value={windowValue(days)}
				onChange={(e) => {
					const next = ESCALATION_WINDOW_OPTIONS.find((o) => windowValue(o) === e.target.value);
					if (next !== undefined) writeEscalationWindow(next);
				}}
				className="rounded-md bg-background-muted px-2 py-1.5 text-sm text-foreground pointer-coarse:min-h-11"
			>
				{ESCALATION_WINDOW_OPTIONS.map((option) => (
					<option key={windowValue(option)} value={windowValue(option)}>
						{WINDOW_LABELS[windowValue(option)]}
					</option>
				))}
			</select>
		</SettingsRow>
	);
}

interface AppearanceSettingsProps {
	showCompleted: boolean;
	onToggleCompleted: () => void;
}

/**
 * iOS-style appearance settings with inline controls
 */
export function AppearanceSettings({
	showCompleted,
	onToggleCompleted,
}: AppearanceSettingsProps) {
	const { theme, setTheme } = useTheme();
	const mounted = useIsHydrated();
	const activeTheme = mounted ? theme : undefined;

	return (
		<>
			{/* Theme Selection Row */}
			<SettingsRow
				label="Theme"
				description="Choose your visual style"
			>
				<div
					className="flex gap-1 bg-background-muted rounded-lg p-1"
					role="group"
					aria-label="Theme options"
					aria-busy={mounted ? undefined : true}
				>
					<ThemeOption
						icon={SunIcon}
						label="Light"
						isActive={activeTheme === "light"}
						onClick={() => setTheme("light")}
						disabled={!mounted}
					/>
					<ThemeOption
						icon={MoonIcon}
						label="Dark"
						isActive={activeTheme === "dark"}
						onClick={() => setTheme("dark")}
						disabled={!mounted}
					/>
					<ThemeOption
						icon={MonitorIcon}
						label="Auto"
						isActive={activeTheme === "system"}
						onClick={() => setTheme("system")}
						disabled={!mounted}
					/>
				</div>
			</SettingsRow>

			<SettingsRow
				label="Show completed"
				description="Display finished tasks in the matrix"
				state={showCompleted}
			>
				<Switch
					aria-label="Show completed"
					checked={showCompleted}
					onCheckedChange={onToggleCompleted}
				/>
			</SettingsRow>
			<EscalationWindowRow />
		</>
	);
}

/**
 * Theme option button
 */
function ThemeOption({
	icon: Icon,
	label,
	isActive,
	onClick,
	disabled,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	isActive: boolean;
	onClick: () => void;
	disabled: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`
				relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
				transition-all duration-200 ease-out
				pointer-coarse:min-h-11 pointer-coarse:px-4
				disabled:cursor-wait disabled:opacity-60
				${isActive
					? "bg-card text-foreground shadow-sm"
					: "text-foreground-muted hover:text-foreground"
				}
			`}
			aria-pressed={isActive}
			disabled={disabled}
		>
			<Icon className="w-3.5 h-3.5" />
			<span>{label}</span>
		</button>
	);
}
