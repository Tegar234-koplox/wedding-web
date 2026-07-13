# Backup and restore rehearsal

## Policy

- Enable PostgreSQL point-in-time recovery or scheduled backups before paid production.
- Record a backup immediately before every migration-bearing release.
- Keep production and staging credentials separate.
- Restore rehearsals run quarterly against an isolated database, never over production.

## Rehearsal

1. Record source backup ID, database version, release SHA, and migration head.
2. Restore into a new isolated PostgreSQL database.
3. Point a temporary Railway staging service at the restored database.
4. Run `python manage.py migrate --plan`, then `python manage.py check --deploy`.
5. Verify one catalog, active order, preview, guest link, RSVP, and audit trail.
6. Compare row counts for core tables and verify media metadata URLs resolve.
7. Destroy temporary credentials and record elapsed recovery time and data-loss window.

The rehearsal is not complete when a provider merely reports that a backup exists. It is
complete only after the application reads the restored data successfully.
