/// <reference path="../pb_data/types.d.ts" />
// Fresh databases have no tasks collection or legacy plaintext to backfill.
// Record the shipped migration filename as applied without changing its
// immutable source in ../pb_migrations.
migrate((_app) => {}, (_app) => {});
