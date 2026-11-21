"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { restoreFocusOrMainContent } from "@/lib/focus-restoration";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      // Same focus and open surface as DropdownMenuItem: solid tide behind ink fell to 2.6:1.
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none pointer-coarse:min-h-11 focus:bg-background-muted focus:text-foreground data-[state=open]:bg-background-muted data-[state=open]:text-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
  </DropdownMenuPrimitive.SubTrigger>
  );
}
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

export function DropdownMenuSubContent({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.SubContent>) {
  return (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-card p-1 text-foreground shadow-md",
      className
    )}
    {...props}
  />
  );
}
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

/**
 * Radix puts focus back on the trigger with a plain focus(), which scrolls the
 * page whenever the trigger sits inside the scroll margin under the topbar.
 * The trigger is still where the user left it (a modal menu freezes the page),
 * so when focus was lost with the menu it goes back without a scroll. The menu
 * names its trigger in aria-labelledby. Focus that already moved on, or a
 * trigger that can't be found, is left to Radix.
 */
function returnFocusToTrigger(event: Event): void {
  if (document.activeElement && document.activeElement !== document.body) return;
  const menu = event.target instanceof Element ? event.target : null;
  const trigger = document.getElementById(menu?.getAttribute("aria-labelledby") ?? "");
  if (!trigger) return;
  event.preventDefault();
  restoreFocusOrMainContent(trigger);
}

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ref,
  onCloseAutoFocus,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Content>) {
  return (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented) returnFocusToTrigger(event);
      }}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-card p-1 text-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
  );
}
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export function DropdownMenuItem({
  className,
  inset,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
}) {
  return (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors pointer-coarse:min-h-11 focus:bg-background-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className
    )}
    {...props}
  />
  );
}
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-background-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
  );
}
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

export function DropdownMenuRadioItem({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-background-muted focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <svg className="h-2 w-2 fill-current" viewBox="0 0 8 8">
          <circle cx="4" cy="4" r="4" />
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
  );
}
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

export function DropdownMenuLabel({
  className,
  inset,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
  );
}
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export function DropdownMenuSeparator({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
  );
}
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
    {...props}
  />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
