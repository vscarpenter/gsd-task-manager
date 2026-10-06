# Migration-set helpers for docker-entrypoint.sh. POSIX sh, sourced not run,
# and kept apart from the entrypoint so tests can call them without a container.

# Print "fresh" or "existing" for the database in $1 (the PocketBase data dir).
# Fails closed: a data.db that sqlite3 cannot read stops startup instead of
# counting as fresh, because the fresh set swaps in a no-op backfill and an
# existing install's plaintext rows would never be encrypted.
gsd_install_state() {
    gsd_db="$1/data.db"
    if [ ! -f "$gsd_db" ]; then
        echo fresh
        return 0
    fi
    if ! gsd_count="$(sqlite3 "$gsd_db" \
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'tasks';")"; then
        echo "[gsd] FATAL: cannot read $gsd_db; refusing to guess whether this is a fresh install" >&2
        return 1
    fi
    if [ "$gsd_count" = "1" ]; then
        echo existing
    else
        echo fresh
    fi
}

# Build the fresh-install migration set in $3: every migration in $1, then the
# files in $2 copied over it so same-named ones are replaced. No file names are
# listed here, so a migration added later reaches fresh installs automatically.
gsd_build_fresh_migrations() {
    mkdir -p "$3"
    cp "$1"/*.js "$3"/
    cp "$2"/*.js "$3"/
}
