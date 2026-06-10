# Security Guidelines for MCP Server

## ⚠️ NEVER COMMIT THESE FILES

The following files contain sensitive credentials and should **NEVER** be committed to git:

- `claude-config.json` - Contains real JWT tokens
- `test-*.sh` - Test scripts with hardcoded credentials
- `debug-*.sh` - Debug scripts with hardcoded credentials
- Any file with real tokens or secrets

These files are listed in `.gitignore` to prevent accidental commits.

## Creating Test Scripts

1. Copy the `.example` file:
   ```bash
   cp test-token.sh.example test-token.sh
   ```

2. Edit the copied file and replace placeholders:
   - `YOUR_JWT_TOKEN_HERE` → Your actual JWT token

3. **NEVER** commit the file without `.example` extension

## Claude Desktop Configuration

Your real Claude Desktop config should be at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Use `claude-config.example.json` as a template, but keep your real credentials in the Claude Desktop config location only.

## Token Lifetime, Revocation, and the Setup Artifact

The MCP server authenticates with your **primary PocketBase session JWT** — the
same token your browser session uses. Anything that can read it has full
read/write/delete access to your tasks until it expires. Know the limits:

- **PocketBase has no per-token revocation.** Logging out in the browser clears
  that browser's copy but does **not** invalidate other copies of the token.
  The only ways to invalidate an issued token early are changing your account
  password/identity or rotating the collection's token secret on the server.
- **The setup wizard writes a token-bearing file** (`~/.gsd-mcp-setup.json`,
  mode 0600) for you to copy into the Claude Desktop config. It is deleted
  automatically the first time the MCP server starts with valid env config,
  and any stale copy is cleared when the wizard re-runs — but delete it
  yourself (`rm ~/.gsd-mcp-setup.json`) if you abandon setup partway.
- **The token lives permanently in the Claude Desktop config**
  (`claude_desktop_config.json`). Treat that file as a credential store:
  don't back it up to shared locations, sync it, or paste it into chats.

## If You Accidentally Commit Credentials

1. **Immediately revoke the exposed credentials**:
   - For JWT tokens: logging out is **not** enough (see above) — change your
     account password or rotate the token secret in PocketBase to invalidate
     all outstanding tokens, then sign in again for a fresh token

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
