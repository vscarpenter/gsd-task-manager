# auth

## Overview
This directory has no source files of its own. It holds one route, the OAuth callback page.

## Subdirectories & Boundaries
- callback: [callback/README.md](./callback/README.md). Client page that relays the OAuth return fragment through `relayOAuthCallback`, then clears it from the URL.
