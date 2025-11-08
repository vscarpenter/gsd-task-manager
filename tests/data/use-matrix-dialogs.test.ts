import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMatrixDialogs } from "@/lib/use-matrix-dialogs";
import { createMockTask } from "@/tests/fixtures";

describe("useMatrixDialogs", () => {
  it("initializes with all dialogs closed", () => {
    const { result } = renderHook(() => useMatrixDialogs());

    expect(result.current.dialogState).toBeNull();
    expect(result.current.helpOpen).toBe(false);
    expect(result.current.importDialogOpen).toBe(false);
    expect(result.current.pendingImportContents).toBeNull();
    expect(result.current.filterPopoverOpen).toBe(false);
    expect(result.current.saveSmartViewOpen).toBe(false);
    expect(result.current.settingsOpen).toBe(false);
    expect(result.current.bulkTagDialogOpen).toBe(false);
    expect(result.current.shareTaskDialogOpen).toBe(false);
    expect(result.current.taskToShare).toBeNull();
  });

  describe("Task Form Dialog", () => {
    it("opens dialog in create mode", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setDialogState({ mode: "create" });
      });

      expect(result.current.dialogState).toEqual({ mode: "create" });
    });

    it("opens dialog in edit mode with task data", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const mockTask = createMockTask({ id: "task-1", title: "Edit Me" });

      act(() => {
        result.current.setDialogState({ mode: "edit", task: mockTask });
      });

      expect(result.current.dialogState).toEqual({
        mode: "edit",
        task: mockTask,
      });
      expect(result.current.dialogState?.task?.title).toBe("Edit Me");
    });

    it("closes dialog using closeDialog helper", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setDialogState({ mode: "create" });
      });

      expect(result.current.dialogState).not.toBeNull();

      act(() => {
        result.current.closeDialog();
      });

      expect(result.current.dialogState).toBeNull();
    });

    it("updates dialog state when switching modes", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const mockTask = createMockTask();

      act(() => {
        result.current.setDialogState({ mode: "create" });
      });

      expect(result.current.dialogState?.mode).toBe("create");

      act(() => {
        result.current.setDialogState({ mode: "edit", task: mockTask });
      });

      expect(result.current.dialogState?.mode).toBe("edit");
      expect(result.current.dialogState?.task).toEqual(mockTask);
    });
  });

  describe("Help Dialog", () => {
    it("opens help dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setHelpOpen(true);
      });

      expect(result.current.helpOpen).toBe(true);
    });

    it("closes help dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setHelpOpen(true);
      });

      act(() => {
        result.current.setHelpOpen(false);
      });

      expect(result.current.helpOpen).toBe(false);
    });
  });

  describe("Import Dialog", () => {
    it("opens import dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setImportDialogOpen(true);
      });

      expect(result.current.importDialogOpen).toBe(true);
    });

    it("closes import dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setImportDialogOpen(true);
      });

      act(() => {
        result.current.setImportDialogOpen(false);
      });

      expect(result.current.importDialogOpen).toBe(false);
    });

    it("stores pending import contents", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const importData = '{"tasks": []}';

      act(() => {
        result.current.setPendingImportContents(importData);
      });

      expect(result.current.pendingImportContents).toBe(importData);
    });

    it("clears pending import contents", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setPendingImportContents('{"tasks": []}');
      });

      act(() => {
        result.current.setPendingImportContents(null);
      });

      expect(result.current.pendingImportContents).toBeNull();
    });
  });

  describe("Filter Popover", () => {
    it("opens filter popover", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setFilterPopoverOpen(true);
      });

      expect(result.current.filterPopoverOpen).toBe(true);
    });

    it("closes filter popover", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setFilterPopoverOpen(true);
      });

      act(() => {
        result.current.setFilterPopoverOpen(false);
      });

      expect(result.current.filterPopoverOpen).toBe(false);
    });
  });

  describe("Save Smart View Dialog", () => {
    it("opens save smart view dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setSaveSmartViewOpen(true);
      });

      expect(result.current.saveSmartViewOpen).toBe(true);
    });

    it("closes save smart view dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setSaveSmartViewOpen(true);
      });

      act(() => {
        result.current.setSaveSmartViewOpen(false);
      });

      expect(result.current.saveSmartViewOpen).toBe(false);
    });
  });

  describe("Settings Dialog", () => {
    it("opens settings dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setSettingsOpen(true);
      });

      expect(result.current.settingsOpen).toBe(true);
    });

    it("closes settings dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setSettingsOpen(true);
      });

      act(() => {
        result.current.setSettingsOpen(false);
      });

      expect(result.current.settingsOpen).toBe(false);
    });
  });

  describe("Bulk Tag Dialog", () => {
    it("opens bulk tag dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setBulkTagDialogOpen(true);
      });

      expect(result.current.bulkTagDialogOpen).toBe(true);
    });

    it("closes bulk tag dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setBulkTagDialogOpen(true);
      });

      act(() => {
        result.current.setBulkTagDialogOpen(false);
      });

      expect(result.current.bulkTagDialogOpen).toBe(false);
    });
  });

  describe("Share Task Dialog", () => {
    it("opens share dialog with task data using helper", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const mockTask = createMockTask({ id: "share-task", title: "Share Me" });

      act(() => {
        result.current.openShareDialog(mockTask);
      });

      expect(result.current.shareTaskDialogOpen).toBe(true);
      expect(result.current.taskToShare).toEqual(mockTask);
    });

    it("closes share dialog and clears task data using helper", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const mockTask = createMockTask();

      act(() => {
        result.current.openShareDialog(mockTask);
      });

      act(() => {
        result.current.closeShareDialog();
      });

      expect(result.current.shareTaskDialogOpen).toBe(false);
      expect(result.current.taskToShare).toBeNull();
    });

    it("opens share dialog using setters directly", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const mockTask = createMockTask();

      act(() => {
        result.current.setTaskToShare(mockTask);
        result.current.setShareTaskDialogOpen(true);
      });

      expect(result.current.shareTaskDialogOpen).toBe(true);
      expect(result.current.taskToShare).toEqual(mockTask);
    });

    it("updates task to share", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const task1 = createMockTask({ id: "task-1", title: "First" });
      const task2 = createMockTask({ id: "task-2", title: "Second" });

      act(() => {
        result.current.setTaskToShare(task1);
      });

      expect(result.current.taskToShare?.title).toBe("First");

      act(() => {
        result.current.setTaskToShare(task2);
      });

      expect(result.current.taskToShare?.title).toBe("Second");
    });
  });

  describe("Multiple Dialogs", () => {
    it("can have multiple dialogs open simultaneously", () => {
      const { result } = renderHook(() => useMatrixDialogs());

      act(() => {
        result.current.setHelpOpen(true);
        result.current.setSettingsOpen(true);
        result.current.setFilterPopoverOpen(true);
      });

      expect(result.current.helpOpen).toBe(true);
      expect(result.current.settingsOpen).toBe(true);
      expect(result.current.filterPopoverOpen).toBe(true);
    });

    it("maintains independent state for each dialog", () => {
      const { result } = renderHook(() => useMatrixDialogs());
      const mockTask = createMockTask();

      act(() => {
        result.current.setDialogState({ mode: "edit", task: mockTask });
        result.current.setImportDialogOpen(true);
        result.current.setPendingImportContents('{"data": "test"}');
      });

      expect(result.current.dialogState?.task).toEqual(mockTask);
      expect(result.current.importDialogOpen).toBe(true);
      expect(result.current.pendingImportContents).toBe('{"data": "test"}');

      act(() => {
        result.current.closeDialog();
      });

      // Other dialogs remain open
      expect(result.current.dialogState).toBeNull();
      expect(result.current.importDialogOpen).toBe(true);
      expect(result.current.pendingImportContents).toBe('{"data": "test"}');
    });
  });
});
