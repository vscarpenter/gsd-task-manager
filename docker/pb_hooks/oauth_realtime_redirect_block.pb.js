/// <reference path="../pb_data/types.d.ts" />
// Disables PocketBase's realtime OAuth redirect. /api/oauth2-redirect delivers
// an authorization code to whichever realtime client the `state` names, so a
// crafted provider link can route a victim's code to an attacker. The web app
// signs in through /api/gsd/oauth-callback instead (oauth_web_redirect.pb.js),
// and the iOS and Android apps never used this path.
//
// Hosted rollout: deploy this file only after the web build that uses
// /api/gsd/oauth-callback is live. Deployed earlier, it breaks sign-in for the
// old web build. The self-hosted image ships web and hooks together, and
// docker/Caddyfile also denies the path at the proxy.

routerUse((e) => {
  const path = e.request.url.path;
  if (path === "/api/oauth2-redirect" || path === "/api/oauth2-redirect/") {
    throw new NotFoundError("PocketBase realtime OAuth redirect is disabled.");
  }
  return e.next();
});
