function allowPublicRequest(rawUrl, method) {
  if (method !== "GET" && method !== "HEAD") return false;
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password) return false;
    if (url.origin === "https://api.vinny.io") {
      return method === "GET" && url.pathname === "/api/health" && !url.search && !url.hash;
    }
    if (url.origin !== "https://gsd.vinny.dev") return false;
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_/")) return false;
    return [...url.searchParams.keys()].every((key) => key === "_rsc");
  } catch {
    return false;
  }
}

module.exports = { allowPublicRequest };
