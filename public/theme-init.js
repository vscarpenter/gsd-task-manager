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
  // immediately leave. The launch flag waits until the visitor leaves /about for
  // the app, so closing the tab on the landing page still shows it next time.
  // Loading /about marks this tab in session storage, and a later full load of
  // the root writes the flag instead of redirecting. That covers a tap on
  // Open App before hydration. FirstTimeRedirect shares the marker and covers
  // client-side navigation and deep links to other routes.
  try {
    var path = location.pathname;
    if (!localStorage.getItem("gsd-has-launched") && !localStorage.getItem("gsd-reset-pending")) {
      if (path === "/about" || path === "/about/" || path === "/about.html") {
        sessionStorage.setItem("gsd-seen-about", "true");
      } else if (path === "/") {
        if (sessionStorage.getItem("gsd-seen-about")) {
          localStorage.setItem("gsd-has-launched", "true");
        } else {
          location.replace("/about/");
        }
      }
    }
  } catch {}
})();
