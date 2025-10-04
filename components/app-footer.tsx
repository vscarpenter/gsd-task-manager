export function AppFooter() {
  return (
    <footer className="mt-10 border-t border-white/5 px-6 py-6 text-xs text-slate-500">
      <p>
        All data stays on this device via IndexedDB. Export regularly if the task schema changes, and reinstall the PWA for offline matrices.
      </p>
    </footer>
  );
}
