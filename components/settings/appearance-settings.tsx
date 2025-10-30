"use client";

import { useTheme } from "next-themes";
import { PaletteIcon, EyeIcon, EyeOffIcon, ChevronRightIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AppearanceSettingsProps {
	isExpanded: boolean;
	onToggle: () => void;
	showCompleted: boolean;
	onToggleCompleted: () => void;
}

export function AppearanceSettings({
	isExpanded,
	onToggle,
	showCompleted,
	onToggleCompleted,
}: AppearanceSettingsProps) {
	const { theme, setTheme } = useTheme();

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
				<div className="flex items-center gap-3">
					<PaletteIcon className="h-5 w-5 text-accent" />
					<span className="font-semibold text-foreground">Appearance</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
				{/* Theme Selection */}
				<div className="space-y-2">
					<Label htmlFor="theme-select">Theme</Label>
					<Select value={theme} onValueChange={setTheme}>
						<SelectTrigger id="theme-select">
							<SelectValue placeholder="Select theme" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="system">System</SelectItem>
							<SelectItem value="light">Light</SelectItem>
							<SelectItem value="dark">Dark</SelectItem>
						</SelectContent>
					</Select>
					<p className="text-xs text-foreground-muted">
						Choose your preferred theme. Changes apply immediately.
					</p>
				</div>

				{/* Show Completed Tasks */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{showCompleted ? (
							<EyeIcon className="h-4 w-4 text-foreground-muted" />
						) : (
							<EyeOffIcon className="h-4 w-4 text-foreground-muted" />
						)}
						<div>
							<Label htmlFor="show-completed">Show completed tasks</Label>
							<p className="text-xs text-foreground-muted">
								Display completed tasks in the matrix view
							</p>
						</div>
					</div>
					<Switch
						id="show-completed"
						checked={showCompleted}
						onCheckedChange={onToggleCompleted}
					/>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
