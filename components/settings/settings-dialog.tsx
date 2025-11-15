"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useTasks } from "@/lib/use-tasks";
import {
	getNotificationSettings,
	updateNotificationSettings,
} from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/types";
import { AppearanceSettings } from "./appearance-settings";
import { NotificationSettingsSection } from "./notification-settings";
import { DataManagement } from "./data-management";
import { ArchiveSettings } from "./archive-settings";
import { SyncSettings } from "./sync-settings";
import { AboutSection } from "./about-section";
import { useRouter } from "next/navigation";
import { getSyncStatus } from "@/lib/sync/config";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	showCompleted: boolean;
	onToggleCompleted: () => void;
	onExport: () => Promise<void>;
	onImport: (file: File) => Promise<void>;
	isLoading?: boolean;
}

export function SettingsDialog({
	open,
	onOpenChange,
	showCompleted,
	onToggleCompleted,
	onExport,
	onImport,
	isLoading,
}: SettingsDialogProps) {
	const { all: tasks } = useTasks();
	const router = useRouter();
	const [mounted, setMounted] = useState(false);
	const [notificationSettings, setNotificationSettings] =
		useState<NotificationSettings | null>(null);
	const [syncEnabled, setSyncEnabled] = useState(false);
	const [pendingSync, setPendingSync] = useState(0);

	// Section expansion state
	const [expandedSections, setExpandedSections] = useState({
		appearance: true,
		notifications: false,
		sync: false,
		archive: false,
		data: false,
		about: false,
	});

	const loadNotificationSettings = async () => {
		const settings = await getNotificationSettings();
		setNotificationSettings(settings);
	};

	const loadSyncStatus = async () => {
		const status = await getSyncStatus();
		setSyncEnabled(status.enabled);
		setPendingSync(status.pendingCount);
	};

	useEffect(() => {
		setMounted(true);
		loadNotificationSettings();
		loadSyncStatus();
	}, []);

	const handleNotificationToggle = async () => {
		if (!notificationSettings) return;

		const newEnabled = !notificationSettings.enabled;

		// Request permission if enabling
		if (newEnabled && "Notification" in window) {
			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				return; // Don't enable if permission denied
			}
		}

		await updateNotificationSettings({ enabled: newEnabled });
		await loadNotificationSettings();
	};

	const handleDefaultReminderChange = async (value: string) => {
		const minutes = parseInt(value);
		await updateNotificationSettings({ defaultReminder: minutes });
		await loadNotificationSettings();
	};

	const handleImportClick = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/json";
		input.onchange = async (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (file) {
				await onImport(file);
				// Close settings dialog after import starts
				onOpenChange(false);
			}
		};
		input.click();
	};

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	const handleViewArchive = () => {
		onOpenChange(false); // Close settings dialog
		router.push("/archive");
	};

	const handleViewSyncHistory = () => {
		onOpenChange(false); // Close settings dialog
		router.push("/sync-history");
	};

	// Calculate storage stats
	const activeTasks = tasks.filter((t) => !t.completed).length;
	const completedTasks = tasks.filter((t) => t.completed).length;
	const estimatedSize = (JSON.stringify(tasks).length / 1024).toFixed(1);

	if (!mounted) {
		return null; // Prevent SSR mismatch
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-2xl font-bold text-foreground">
						Settings
					</DialogTitle>
					<DialogDescription className="text-foreground-muted">
						Configure appearance, notifications, and data management preferences
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					{/* Appearance Section */}
					<AppearanceSettings
						isExpanded={expandedSections.appearance}
						onToggle={() => toggleSection("appearance")}
						showCompleted={showCompleted}
						onToggleCompleted={onToggleCompleted}
					/>

					{/* Notifications Section */}
					<NotificationSettingsSection
						isExpanded={expandedSections.notifications}
						onToggle={() => toggleSection("notifications")}
						settings={notificationSettings}
						onNotificationToggle={handleNotificationToggle}
						onDefaultReminderChange={handleDefaultReminderChange}
					/>

					{/* Cloud Sync Section - Only show when sync is enabled */}
					{syncEnabled && (
						<SyncSettings
							isExpanded={expandedSections.sync}
							onToggle={() => toggleSection("sync")}
							onViewHistory={handleViewSyncHistory}
						/>
					)}

					{/* Archive Section */}
					<ArchiveSettings
						isExpanded={expandedSections.archive}
						onToggle={() => toggleSection("archive")}
						onViewArchive={handleViewArchive}
					/>

					{/* Data & Backup Section */}
					<DataManagement
						isExpanded={expandedSections.data}
						onToggle={() => toggleSection("data")}
						activeTasks={activeTasks}
						completedTasks={completedTasks}
						totalTasks={tasks.length}
						estimatedSize={estimatedSize}
						onExport={onExport}
						onImportClick={handleImportClick}
						isLoading={isLoading}
						syncEnabled={syncEnabled}
						pendingSync={pendingSync}
					/>

					{/* About Section */}
					<AboutSection
						isExpanded={expandedSections.about}
						onToggle={() => toggleSection("about")}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
