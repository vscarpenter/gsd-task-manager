import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  useShellCommandHandlers,
  NEW_TASK_EVENT,
  HIGHLIGHT_TASK_EVENT,
  APPLY_SMART_VIEW_EVENT,
} from "@/lib/use-shell-command-handlers";

const pushMock = vi.fn();
const setThemeMock = vi.fn();
let themeState = { theme: "system", resolvedTheme: "dark", setTheme: setThemeMock };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeState,
}));

function navigateTo(pathname: string) {
  window.history.pushState({}, "", pathname);
}

beforeEach(() => {
  vi.clearAllMocks();
  themeState = { theme: "system", resolvedTheme: "dark", setTheme: setThemeMock };
  navigateTo("/");
});

afterEach(() => {
  navigateTo("/");
});

describe("useShellCommandHandlers", () => {
  it("dispatches a highlight event when selecting a task on the matrix route", () => {
    navigateTo("/");
    const listener = vi.fn();
    window.addEventListener(HIGHLIGHT_TASK_EVENT, listener);

    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.onSelectTask("task-1");

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ taskId: "task-1" });
    expect(pushMock).not.toHaveBeenCalled();
    window.removeEventListener(HIGHLIGHT_TASK_EVENT, listener);
  });

  it("navigates with a highlight query when selecting a task off the matrix route", () => {
    navigateTo("/dashboard");
    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.onSelectTask("task 2");

    expect(pushMock).toHaveBeenCalledWith("/?highlight=task%202");
  });

  it("dispatches a new-task event on the matrix route", () => {
    navigateTo("/");
    const listener = vi.fn();
    window.addEventListener(NEW_TASK_EVENT, listener);

    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onNewTask();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    window.removeEventListener(NEW_TASK_EVENT, listener);
  });

  it("navigates to a create-task URL off the matrix route", () => {
    navigateTo("/settings");
    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onNewTask();

    expect(pushMock).toHaveBeenCalledWith("/?action=new-task");
  });

  it("toggles theme from resolved dark to light when set to system", () => {
    themeState = { theme: "system", resolvedTheme: "dark", setTheme: setThemeMock };
    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onToggleTheme();
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("toggles theme from explicit light to dark", () => {
    themeState = { theme: "light", resolvedTheme: "light", setTheme: setThemeMock };
    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onToggleTheme();
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("routes export, import, settings, dashboard, matrix and archive actions", async () => {
    const { result } = renderHook(() => useShellCommandHandlers());
    await result.current.handlers.onExportTasks();
    result.current.handlers.onImportTasks();
    result.current.handlers.onOpenSettings();
    result.current.handlers.onViewDashboard();
    result.current.handlers.onViewMatrix();
    result.current.handlers.onViewArchive();

    expect(pushMock.mock.calls.map((c) => c[0])).toEqual([
      "/settings",
      "/settings",
      "/settings",
      "/dashboard",
      "/",
      "/archive",
    ]);
  });

  it("dispatches an open-help window event", () => {
    const listener = vi.fn();
    window.addEventListener("gsd:open-help", listener);
    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onOpenHelp();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("gsd:open-help", listener);
  });

  it("dispatches a smart-view event on the matrix route", () => {
    navigateTo("/");
    const listener = vi.fn();
    window.addEventListener(APPLY_SMART_VIEW_EVENT, listener);

    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onApplySmartView({ search: "x" }, "view-1");

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ viewId: "view-1", criteria: { search: "x" } });
    window.removeEventListener(APPLY_SMART_VIEW_EVENT, listener);
  });

  it("navigates with a smart-view query off the matrix route", () => {
    navigateTo("/dashboard");
    const { result } = renderHook(() => useShellCommandHandlers());
    result.current.handlers.onApplySmartView({ search: "x" }, "view 2");
    expect(pushMock).toHaveBeenCalledWith("/?smartView=view%202");
  });

  it("exposes default shell conditions", () => {
    const { result } = renderHook(() => useShellCommandHandlers());
    expect(result.current.conditions).toEqual({
      isSyncEnabled: false,
      selectionMode: false,
      hasSelection: false,
    });
  });
});
