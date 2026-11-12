# Security Guidelines for MCP Server

## ⚠️ NEVER COMMIT THESE FILES

The following files contain sensitive credentials and should **NEVER** be committed to git:

- `claude-config.json` - Contains real JWT tokens
- `test-*.sh` - Test scripts with hardcoded credentials
- `debug-*.sh` - Debug scripts with hardcoded credentials
- `*-token*.sh` and `*-passphrase*.sh` - Helper scripts that hold a token or passphrase
- Any file with real tokens or secrets

`.gitignore` lists the named patterns to prevent accidental commits.

## Creating Test Scripts

1. Copy the `.example` file:
   ```bash
   cp test-token.sh.example test-token.sh
   ```

2. Edit the copied file and replace placeholders:
   - `YOUR_AUTH_TOKEN_HERE` → Your actual JWT token

3. **NEVER** commit the file without `.example` extension

## Claude Desktop Configuration

Your real Claude Desktop config should be at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Use `claude-config.example.json` as a template, but keep your real credentials in the Claude Desktop config location only.

## Token Lifetime, Revocation, and the Setup Artifact

The MCP server authenticates with your **primary PocketBase session JWT**, the
same token your browser session uses. The MCP server refuses a PocketBase
superuser token before it registers any tool. A superuser JWT names its own
collection, so that check decodes the token locally and needs no network. On a
superuser token, the process prints recovery steps to stderr and exits.
Confirming that a token belongs to a user account needs PocketBase. The
user-account check runs before any write and before `get_sync_status`. An
unreachable PocketBase never stops the MCP server. Tools stay registered, and each call reports the connection problem without
changing your saved credentials. Anything that can read a user token has full
read/write/delete access to that account's tasks until the token expires. Tokens last 30 days (the `users`
collection's auth duration, set by `docker/pb_migrations/1793562900_users_auth_token_30_days.js`),
and the MCP server never renews the one in its config. Know the limits:

- **Revoking a token.** Signing out in the browser clears that browser's copy
  but does **not** invalidate other copies of the token. On a self-hosted
  (Docker) server, the sync dialog's Sign out of all devices button rotates your
  account's token key. That ends every session for your account, including the
  copy of the token in the MCP config
  (`docker/pb_hooks/session_revoke.pb.js`). On the hosted service that button
  signs out only the current device, and an issued token stays valid until it
  expires (at most 30 days). The server operator can end it sooner by rotating
  the users collection's token secret, which signs out every user. Accounts sign in with Google, Apple, or
  GitHub, so there is no account password to change.
- **The setup wizard (`gsd-mcp-server --setup`) writes a token-bearing file** (`~/.gsd-mcp-setup.json`,
  mode 0600) for you to copy into the Claude Desktop config. It is deleted
  automatically the first time the MCP server starts with valid env config —
  including an offline start —
  and any stale copy is cleared when the wizard re-runs — but delete it
  yourself (`rm ~/.gsd-mcp-setup.json`) if you abandon setup partway.
  The wizard never prints the full token or identifying token fragments. Open
  the artifact only in a trusted editor; do not print it to terminal history or logs.
- **The Claude Desktop entry the wizard generates is pinned locally.** It invokes
  the exact Node executable and package entrypoint that ran the wizard, rather than selecting
  the latest package from npm on every credentialed start. Updating is an explicit
  exact-version install followed by another setup run.
- **The token stays in the Claude Desktop config until you replace it**
  (`claude_desktop_config.json`). When it expires, copy a fresh one from the
  web app. Treat that file as a credential store:
  don't back it up to shared locations, sync it, or paste it into chats.

## If You Accidentally Commit Credentials

1. **Immediately revoke the exposed credentials**:
   - For JWT tokens: signing out on one device is **not** enough (see above).
     On a self-hosted server, use Sign out of all devices in the sync
     dialog. On the hosted service, ask the operator to rotate the users
     collection's token secret. Then sign in again for a fresh token

2. **Remove from git history**:
   ```bash
   # Remove specific file from all commits
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch packages/mcp-server/FILENAME" \
     --prune-empty --tag-name-filter cat -- --all

   # Force push to remote
   git push origin --force --all
   ```

3. **Notify your security team** if this is a company/team repository

## Best Practices

- ✅ Use `.example` files for templates
- ✅ Keep real credentials in `.gitignore`d files
- ✅ Use environment variables when possible
- ✅ Rotate credentials regularly
- ✅ Use different credentials for dev/staging/prod
- ❌ Never hardcode credentials in committed code
- ❌ Never share credentials in chat/email/Slack
- ❌ Never commit files with real tokens
