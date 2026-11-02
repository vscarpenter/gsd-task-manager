/// <reference path="../pb_data/types.d.ts" />
// Auth tokens for the users collection last 30 days (was 7 on gsd.vinny.dev,
// and PocketBase's default for a new install is 5). Web, iOS, and Android all
// renew a token once 7 days or fewer remain, so anyone who opens the app in a
// token's last week stays signed in. The MCP server never renews: a token
// pasted into the Claude Desktop config now lasts 30 days.
//
// Only the duration changes, never the token secret, so no live token stops
// working. Existing tokens keep their old expiry until their next renewal.
// Raise-only: a server set to 30 days or longer by hand is left alone.
migrate((app) => {
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  let users;
  try {
    users = app.findCollectionByNameOrId("users");
  } catch {
    return; // No users collection: nothing to sign in to, so nothing to change.
  }
  if (users.authToken.duration >= THIRTY_DAYS) return;
  users.authToken.duration = THIRTY_DAYS;
  app.save(users);
}, (app) => {
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;
  let users;
  try {
    users = app.findCollectionByNameOrId("users");
  } catch {
    return;
  }
  // Revert only what this migration set; keep any value chosen since.
  if (users.authToken.duration !== THIRTY_DAYS) return;
  users.authToken.duration = SEVEN_DAYS;
  app.save(users);
});
