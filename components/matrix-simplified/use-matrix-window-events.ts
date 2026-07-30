/**
 * Wires window/URL inputs to matrix actions: global keyboard shortcuts, the
 * PWA/bookmarklet URL action params, deep-link highlight/smart-view params, and
 * shell command events. Extracted from MatrixSimplified so the component body
 * isn't dominated by event-subscription boilerplate.
 */

import { useEffect, useEffectEvent, type RefObject } from "react";
import { parseShareCaptureParams } from "@/lib/share-capture";
import { UI_TIMING } from "@/lib/constants/ui";
import type { TaskDraft } from "@/lib/types";
import {
  APPLY_SMART_VIEW_EVENT,
  HIGHLIGHT_TASK_EVENT,
  NEW_TASK_EVENT,
  type ApplySmartViewEventDetail,
} from "@/lib/use-shell-command-handlers";

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

export interface MatrixWindowEventsDeps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  captureInputRef: RefObject<HTMLInputElement | null>;
  openCreateDrawer: (initial?: TaskDraft) => void;
  highlightTaskById: (taskId: string) => void;
  applySmartViewById: (viewId: string) => Promise<void>;
}

export function useMatrixWindowEvents({
  searchInputRef,
  captureInputRef,
  openCreateDrawer,
  highlightTaskById,
  applySmartViewById,
}: MatrixWindowEventsDeps): void {
  const openCreateDrawerEvent = useEffectEvent((initial?: TaskDraft) => {
    openCreateDrawer(initial);
  });

  // URL-driven actions: the PWA shortcut remains a query action, while the
  // bookmarklet uses a client-only fragment so task content is never sent in
  // the navigation request. Legacy query captures are removed but not opened.
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const fragmentParams = new URLSearchParams(window.location.hash.slice(1));
    const queryAction = queryParams.get("action");
    const fragmentAction = fragmentParams.get("action");
    const isNewTaskAction = queryAction === "new-task";
    const isLegacyCapture = queryAction === "capture";
    const isFragmentCapture = fragmentAction === "capture";
    if (!isNewTaskAction && !isLegacyCapture && !isFragmentCapture) return;

    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    if (isNewTaskAction && !isFragmentCapture) {
      focusTimer = setTimeout(() => captureInputRef.current?.focus(), UI_TIMING.FOCUS_DELAY_MS);
    } else if (isFragmentCapture) {
      const draft = parseShareCaptureParams(fragmentParams);
      if (draft) {
        captureInputRef.current?.focus();
        openCreateDrawerEvent(draft);
      }
    }

    if (isNewTaskAction || isLegacyCapture) {
      ["action", "title", "url", "tags"].forEach((key) => queryParams.delete(key));
    }
    if (isFragmentCapture) {
      ["action", "title", "url", "tags"].forEach((key) => fragmentParams.delete(key));
    }

    const nextQuery = queryParams.toString();
    const nextFragment = isFragmentCapture
      ? fragmentParams.toString()
      : window.location.hash.slice(1);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${
        nextFragment ? `#${nextFragment}` : ""
      }`
    );

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [captureInputRef]);

  // Global "/" focuses search; "n" handled by CaptureBar; "?" opens help
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("gsd:open-help"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchInputRef]);

  // Deep-link params: ?highlight=<taskId> and ?smartView=<viewId>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get("highlight");
    const smartViewId = params.get("smartView");
    if (!taskId && !smartViewId) return;

    const frame = window.requestAnimationFrame(() => {
      if (taskId) {
        highlightTaskById(taskId);
      }
      if (smartViewId) {
        void applySmartViewById(smartViewId);
      }
    });
    params.delete("highlight");
    params.delete("smartView");
    const next = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    return () => window.cancelAnimationFrame(frame);
  }, [applySmartViewById, highlightTaskById]);

  // Shell command events (⌘K palette, etc.).
  useEffect(() => {
    const openNewTask = () => openCreateDrawer();
    const highlightTask = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId) {
        highlightTaskById(taskId);
      }
    };
    const applySmartView = (event: Event) => {
      const viewId = (event as CustomEvent<ApplySmartViewEventDetail>).detail?.viewId;
      if (viewId) {
        void applySmartViewById(viewId);
      }
    };

    window.addEventListener(NEW_TASK_EVENT, openNewTask);
    window.addEventListener(HIGHLIGHT_TASK_EVENT, highlightTask);
    window.addEventListener(APPLY_SMART_VIEW_EVENT, applySmartView);
    window.addEventListener("highlightTask", highlightTask);
    return () => {
      window.removeEventListener(NEW_TASK_EVENT, openNewTask);
      window.removeEventListener(HIGHLIGHT_TASK_EVENT, highlightTask);
      window.removeEventListener(APPLY_SMART_VIEW_EVENT, applySmartView);
      window.removeEventListener("highlightTask", highlightTask);
    };
  }, [applySmartViewById, highlightTaskById, openCreateDrawer]);
}
