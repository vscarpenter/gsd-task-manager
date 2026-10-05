/// <reference path="../pb_data/types.d.ts" />
// Web OAuth return route. Providers send the browser here after sign-in:
// Google and GitHub with GET, Apple with POST (form_post). The route
// redirects to the web app's callback page, where only the tab that started
// sign-in holds the matching state and PKCE verifier. It replaces
// PocketBase's /api/oauth2-redirect, which hands the code to whichever
// realtime client the state names (see docker/Caddyfile).
//
// GSD_WEB_OAUTH_CALLBACK_URL sets the callback page. The default is the
// same-origin /auth/callback/ that this image serves; the hosted service sets
// https://gsd.vinny.dev/auth/callback/. The target comes only from the
// environment, never from the request, so the route can't be an open redirect.
// Params are read with FormValue, which returns raw strings from the form body
// or query; requestInfo().body would type-convert numeric-looking values.
// Hook callbacks run in isolated VMs, so each one loads its own dependencies.

routerAdd("GET", "/api/gsd/oauth-callback", (e) => {
  // react-doctor-disable-next-line react-doctor/no-dynamic-import-path -- PocketBase `require(`${__hooks}/..`)` is its required hook idiom
  const { callbackLocation } = require(`${__hooks}/oauth-web-redirect.js`);
  const target = $os.getenv("GSD_WEB_OAUTH_CALLBACK_URL") || "/auth/callback/";
  return e.redirect(303, callbackLocation((name) => e.request.formValue(name), target));
});

routerAdd("POST", "/api/gsd/oauth-callback", (e) => {
  // react-doctor-disable-next-line react-doctor/no-dynamic-import-path -- PocketBase `require(`${__hooks}/..`)` is its required hook idiom
  const { callbackLocation } = require(`${__hooks}/oauth-web-redirect.js`);
  const target = $os.getenv("GSD_WEB_OAUTH_CALLBACK_URL") || "/auth/callback/";
  return e.redirect(303, callbackLocation((name) => e.request.formValue(name), target));
});
