"use client";

import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { SettingsRow } from "./shared-components";

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

			{/* Show Completed Toggle Row */}
			<SettingsRow
				label="Show completed"
				description="Display finished tasks in the matrix"
				state={showCompleted}
			>
				<Switch
					checked={showCompleted}
					onCheckedChange={onToggleCompleted}
				/>
			</SettingsRow>
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
