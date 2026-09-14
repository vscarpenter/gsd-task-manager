(function initializeTheme() {
  var root = document.documentElement;
  var themes = ["light", "dark"];
  var stored;
  try {
    stored = localStorage.getItem("gsd-theme") || "system";
  } catch {
    stored = "system";
  }
  var resolved = stored === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : stored;
  root.classList.remove.apply(root.classList, themes);
  root.classList.add(resolved);
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;

  // First-visit redirect, done here rather than after React hydrates: a new
  // visitor on the app root is sent to the marketing page before the matrix
  // bundle downloads and boots, so they never pay to render a page they
  // immediately leave. The React-side FirstTimeRedirect stays as the fallback
  // for deep links to other routes; it sees the flag already set here and no-ops.
  try {
    if (
      location.pathname === "/" &&
      !localStorage.getItem("gsd-has-launched") &&
      !localStorage.getItem("gsd-reset-pending")
    ) {
      localStorage.setItem("gsd-has-launched", "true");
      location.replace("/about/");
    }
  } catch {}
})();
