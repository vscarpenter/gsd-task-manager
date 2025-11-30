"use client";

import { useTheme } from "next-themes";
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

	return (
		<>
			{/* Theme Selection Row */}
			<SettingsRow
				label="Theme"
				description="Choose your visual style"
			>
				<div className="flex gap-1 bg-background-muted rounded-lg p-1">
					<ThemeOption
						icon={SunIcon}
						label="Light"
						isActive={theme === "light"}
						onClick={() => setTheme("light")}
					/>
					<ThemeOption
						icon={MoonIcon}
						label="Dark"
						isActive={theme === "dark"}
						onClick={() => setTheme("dark")}
					/>
					<ThemeOption
						icon={MonitorIcon}
						label="Auto"
						isActive={theme === "system"}
						onClick={() => setTheme("system")}
					/>
				</div>
			</SettingsRow>

			{/* Show Completed Toggle Row */}
			<SettingsRow
				label="Show completed"
				description="Display finished tasks in the matrix"
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
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className={`
				relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
				transition-all duration-200
				${isActive
					? "bg-card text-foreground shadow-sm"
					: "text-foreground-muted hover:text-foreground"
				}
			`}
			aria-pressed={isActive}
		>
			<Icon className="w-3.5 h-3.5" />
			<span>{label}</span>
		</button>
	);
}
