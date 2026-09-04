#!/usr/bin/env bash
# The former scheduled builder executed mutable issue content with maintainer
# credentials. It is intentionally retired until approval can be bound to an
# immutable snapshot and execution can move to an ephemeral credential-free
# runner.
set -euo pipefail

for arg in "$@"; do
  case "$arg" in
    --dry-run | --check | "") ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

echo "DISABLED: unattended builder execution is retired."
echo "REQUIRED: trusted approval over immutable issue bytes and an ephemeral credential-free runner."
