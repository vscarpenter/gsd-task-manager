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

## If You Accidentally Commit Credentials

1. **Immediately revoke the exposed credentials**:
   - For JWT tokens: Log out and log back in to get a new token

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
