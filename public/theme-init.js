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
})();
