/* eslint-disable react/no-unescaped-entities */
"use client";

import { ChevronRightIcon } from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

// GuideSection Component
interface GuideSectionProps {
	icon: React.ReactNode;
	title: string;
	expanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

export function GuideSection({
	icon,
	title,
	expanded,
	onToggle,
	children,
}: GuideSectionProps) {
	return (
		<Collapsible open={expanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80 transition-colors">
				<div className="flex items-center gap-3">
					<div className="text-accent">{icon}</div>
					<span className="font-semibold text-foreground">{title}</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${expanded ? "rotate-90" : ""}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}

// QuadrantBlock Component
interface QuadrantBlockProps {
	title: string;
	color: string;
	description: string;
	examples: string[];
	strategy: string;
	timeAllocation: string;
}

export function QuadrantBlock({
	title,
	color,
	description,
	examples,
	strategy,
	timeAllocation,
}: QuadrantBlockProps) {
	return (
		<div className="rounded-lg border border-card-border bg-background-muted/30 p-4">
			<div className="flex items-center justify-between mb-2">
				<span className={`rounded px-3 py-1 text-sm font-semibold ${color}`}>
					{title}
				</span>
				<span className="text-xs font-medium text-foreground-muted">
					Target: {timeAllocation}
				</span>
			</div>
			<p className="text-sm text-foreground-muted mb-2">{description}</p>
			<div className="text-xs text-foreground-muted mb-2">
				<strong>Examples:</strong>
				<ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
					{examples.map((example, idx) => (
						<li key={idx}>{example}</li>
					))}
				</ul>
			</div>
			<div className="text-xs bg-background rounded p-2 border border-border">
				<strong className="text-accent">Strategy:</strong>{" "}
				<span className="text-foreground-muted">{strategy}</span>
			</div>
		</div>
	);
}

// FeatureBlock Component
interface FeatureBlockProps {
	title: string;
	items: string[];
}

export function FeatureBlock({ title, items }: FeatureBlockProps) {
	return (
		<div>
			<h4 className="font-semibold text-foreground mb-2">{title}</h4>
			<ul className="space-y-1 text-foreground-muted list-disc list-inside">
				{items.map((item, idx) => (
					<li key={idx}>{item}</li>
				))}
			</ul>
		</div>
	);
}

// AdvancedFeature Component
interface AdvancedFeatureProps {
	icon: React.ReactNode;
	title: string;
	description: string;
	children: React.ReactNode;
}

export function AdvancedFeature({
	icon,
	title,
	description,
	children,
}: AdvancedFeatureProps) {
	return (
		<div className="rounded-lg border border-card-border bg-background-muted/30 p-4">
			<div className="flex items-center gap-2 mb-2">
				<div className="text-accent">{icon}</div>
				<h4 className="font-semibold text-foreground">{title}</h4>
			</div>
			<p className="text-sm text-foreground-muted mb-3">{description}</p>
			{children}
		</div>
	);
}

// WorkflowBlock Component
interface WorkflowBlockProps {
	title: string;
	steps: string[];
}

export function WorkflowBlock({ title, steps }: WorkflowBlockProps) {
	return (
		<div className="rounded-lg border border-card-border bg-background-muted/30 p-4">
			<h4 className="font-semibold text-foreground mb-2">{title}</h4>
			<ol className="space-y-1 text-foreground-muted list-decimal list-inside">
				{steps.map((step, idx) => (
					<li key={idx}>{step}</li>
				))}
			</ol>
		</div>
	);
}

// ShortcutRow Component
interface ShortcutRowProps {
	shortcut: string;
	description: string;
}

export function ShortcutRow({ shortcut, description }: ShortcutRowProps) {
	return (
		<div className="flex items-center justify-between rounded-lg bg-background-muted px-3 py-2">
			<span className="text-foreground">{description}</span>
			<kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono text-foreground-muted">
				{shortcut}
			</kbd>
		</div>
	);
}
