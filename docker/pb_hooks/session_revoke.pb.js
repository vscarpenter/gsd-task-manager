/// <reference path="../pb_data/types.d.ts" />
// "Sign out of all devices" (SEC-002). PocketBase auth tokens are stateless, so
// rotating the caller's token key is the only way to end their sessions on the
// server: every token issued before the rotation stops verifying at once,
// including tokens copied into an AI assistant's MCP config.

routerAdd(
  "DELETE",
  "/api/gsd/sessions",
  (e) => {
    // saveNoValidate: a field rule added to users later must not block a revoke.
    e.auth.refreshTokenKey();
    e.app.saveNoValidate(e.auth);
    return e.noContent(204);
  },
  $apis.requireAuth("users"),
);
