# Security Notes

## Sensitive Files

Do not commit the following files unless explicitly reviewed:

- `.env`
- `.env.*` except `.env.example`
- `*.log`
- `*.pem`
- `*.key`
- `*.p12`
- `*.pfx`
- local database files
- deployment metadata such as `.vercel/`
- screenshots containing tokens, QR codes, user data, or internal URLs

## Immediate Review Areas

The following project areas should be reviewed first:

1. Environment variables and example secrets
2. Log files moved to `artifacts/logs/`
3. Screenshots moved to `artifacts/screenshots/`
4. Docker and deployment configuration
5. Build output and source maps
6. API authorization and role checks

## If a Secret Is Found

1. Revoke or rotate the secret immediately.
2. Remove the secret from the repository.
3. Purge it from Git history if necessary.
4. Re-deploy affected services.
5. Review logs for suspicious access.
