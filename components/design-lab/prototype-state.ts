"use client";

import { useMemo, useRef, useState } from "react";

import {
  DESIGN_TASKS,
  filterDesignTasks,
  groupDesignTasks,
  type DesignQuadrantId,
  type DesignTask,
} from "./design-data";

export type PrototypeTheme = "light" | "dark";
export type PrototypeView = "matrix" | "review";

export interface PrototypeState {
  tasks: DesignTask[];
  visibleTasks: DesignTask[];
  groupedTasks: Record<DesignQuadrantId, DesignTask[]>;
  query: string;
  setQuery: (query: string) => void;
  view: PrototypeView;
  setView: (view: PrototypeView) => void;
  theme: PrototypeTheme;
  toggleTheme: () => void;
  activeQuadrant: DesignQuadrantId;
  setActiveQuadrant: (quadrant: DesignQuadrantId) => void;
  editorTask: DesignTask | null;
  openEditor: (task: DesignTask, opener?: HTMLElement) => void;
  closeEditor: () => void;
  addTask: (title: string, quadrant?: DesignQuadrantId) => void;
  updateTask: (taskId: string, title: string, quadrant: DesignQuadrantId) => void;
  toggleTask: (taskId: string) => void;
  announcement: string;
  announcementVersion: number;
}

export function usePrototypeState(initialTheme: PrototypeTheme = "light"): PrototypeState {
  const [tasks, setTasks] = useState<DesignTask[]>(() => DESIGN_TASKS.map((task) => ({ ...task })));
  const [query, setQuery] = useState("");
  const [view, setView] = useState<PrototypeView>("matrix");
  const [theme, setTheme] = useState<PrototypeTheme>(initialTheme);
  const [activeQuadrant, setActiveQuadrantValue] = useState<DesignQuadrantId>("q2");
  const [editorTask, setEditorTask] = useState<DesignTask | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [announcementVersion, setAnnouncementVersion] = useState(0);
  const editorOpener = useRef<HTMLElement | null>(null);

  const visibleTasks = useMemo(() => filterDesignTasks(tasks, query), [query, tasks]);
  const groupedTasks = useMemo(() => groupDesignTasks(visibleTasks), [visibleTasks]);

  const toggleTheme = (): void => setTheme((current) => (current === "light" ? "dark" : "light"));
  const announce = (message: string): void => {
    setAnnouncement(message);
    setAnnouncementVersion((current) => current + 1);
  };
  const setActiveQuadrant = (quadrant: DesignQuadrantId): void => {
    setActiveQuadrantValue(quadrant);
    const title = { q1: "Do First", q2: "Schedule", q3: "Delegate", q4: "Eliminate" }[quadrant];
    announce(`${title} is now the capture focus`);
  };
  const openEditor = (task: DesignTask, opener?: HTMLElement): void => {
    editorOpener.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setEditorTask(task);
  };
  const closeEditor = (): void => {
    const opener = editorOpener.current;
    setEditorTask(null);
    editorOpener.current = null;
    requestAnimationFrame(() => {
      if (opener?.isConnected) {
        opener.focus();
      } else {
        document.getElementById("prototype-main")?.focus();
      }
    });
  };

  const addTask = (title: string, quadrant: DesignQuadrantId = activeQuadrant): void => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const task: DesignTask = {
      id: `captured-${tasks.length + 1}`,
      title: trimmed,
      description: "Captured in the design lab. This mock state stays in memory only.",
      quadrant,
      tags: [],
      completed: false,
    };
    setTasks((current) => [task, ...current]);
    const quadrantTitle = { q1: "Do First", q2: "Schedule", q3: "Delegate", q4: "Eliminate" }[quadrant];
    announce(`Added ${trimmed} to ${quadrantTitle}`);
  };

  const updateTask = (taskId: string, title: string, quadrant: DesignQuadrantId): void => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, title: title.trim(), quadrant } : task
    )));
    announce("Task updated");
    closeEditor();
  };

  const toggleTask = (taskId: string): void => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, completed: !task.completed } : task
    )));
    announce("Task completion updated");
  };

  return {
    tasks,
    visibleTasks,
    groupedTasks,
    query,
    setQuery,
    view,
    setView,
    theme,
    toggleTheme,
    activeQuadrant,
    setActiveQuadrant,
    editorTask,
    openEditor,
    closeEditor,
    addTask,
    updateTask,
    toggleTask,
    announcement,
    announcementVersion,
  };
}
