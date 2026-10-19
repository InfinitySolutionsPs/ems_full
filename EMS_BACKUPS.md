# EMS backups

The Docker Compose stack includes a private backup service. It creates a PostgreSQL custom-format dump and a compressed copy of `/app/data/uploads` every day at 02:00 Asia/Hebron. It keeps local archives for seven days in the persistent `ems_backups` volume. If OneDrive is configured, archives are uploaded to `PRCS-Backups/EMS` and remote copies older than 30 days are removed. The service is not exposed through the public proxy.

## Coolify environment variables

Set `BACKUP_API_TOKEN` to a random value shared by the `app` and `backup` services. Generate it in a trusted password manager or terminal, for example with `openssl rand -hex 32`. Coolify substitutes this value into both services; it is not committed to the repository. This is needed for the admin page's status, download, and on-demand controls.

To enable automatic OneDrive for Business uploads, install rclone on a trusted administrator workstation, create a remote named `onedrive` with `rclone config`, sign in to the organization account, and choose the Business drive. Run `rclone config show onedrive` and copy only the JSON value of its `token` field into Coolify's secret `ONEDRIVE_TOKEN_JSON` (never paste that token into chat or GitHub). If the remote uses a custom Entra application, also set `ONEDRIVE_CLIENT_ID` and `ONEDRIVE_CLIENT_SECRET`. Optionally set `ONEDRIVE_FOLDER`; it defaults to `PRCS-Backups/EMS`.

Deploy/redeploy the Compose stack after setting the variables. The backup service stores its rclone configuration in a persistent named volume and refreshes OAuth tokens there. The EMS page at **النسخ الاحتياطي** reports whether cloud upload is configured; without the token, scheduled and manual backups still run locally and are clearly shown as local-only.

## Operations

- Daily backup: 02:00 Asia/Hebron, independent of the Next.js app process.
- On demand: **النسخ الاحتياطي → إنشاء نسخة الآن**.
- Restore candidate: download the latest archive from that page; it contains `database.dump` and `uploads/`.
- Local archive retention: seven days. OneDrive retention: 30 days.
- Always perform and document a test restore before relying on backups for disaster recovery. Keep database credentials and Microsoft OAuth tokens out of Git.
