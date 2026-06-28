# Staging and Production Database Safety

This project should use two separate database targets:

- Production website: `main` branch, live Hostinger domain, production MongoDB database.
- Staging/testing: feature or `staging` branch, test Hostinger domain or local app, staging MongoDB database.

Do not test schema changes, seed scripts, migrations, fake orders, approvals, or new roles against the production database.

## Environment Files

Real env files are ignored by Git. Use the committed examples as templates only.

Backend templates:

```text
Server/.env.staging.example
Server/.env.production.example
```

Frontend template:

```text
Frontend/meitupaints/.env.staging.example
```

Create local staging env files from the examples:

```bash
cp Server/.env.staging.example Server/.env.staging
cp Frontend/meitupaints/.env.staging.example Frontend/meitupaints/.env.staging
```

Then fill the real staging secrets. Never commit the real files.

## Required DB Environment Labels

Use these labels in env files and Hostinger env vars:

```env
# Production
NODE_ENV=production
DB_ENV=production

# Staging
NODE_ENV=staging
DB_ENV=staging
```

The seed/write safety guard treats `production`, `prod`, and `live` as production-like.

## Local Staging Commands

From the repo root:

```bash
npm run start:staging
```

From `Server/`:

```bash
npm run dev:staging
npm run start:staging
```

Safe staging seed/append commands from `Server/`:

```bash
npm run staging:seed:admin
npm run staging:append:families
npm run staging:append:products
```

Full rewrite staging seeds are available but should be used only when you intend to rebuild staging catalog data:

```bash
npm run staging:seed:families
npm run staging:seed:products
```

## Production Write Protection

Seed and append scripts call `assertSafeDatabaseWrite()` before connecting to MongoDB.

If the target looks production-like, scripts fail unless this is set:

```env
ALLOW_PRODUCTION_DB_WRITE=true
```

Full destructive rewrite seeds also require:

```env
ALLOW_DESTRUCTIVE_SEED=true
```

Do not set either flag in normal production hosting. Use them only for a planned, backed-up production operation.

## Copy Production Data to Staging

Copy only from production to staging, never staging to production.

Example with separate database names:

```bash
mongodump --uri="PRODUCTION_MONGO_URI" --out=prod-backup

mongorestore \
  --uri="STAGING_MONGO_URI" \
  --nsFrom="meitu_production.*" \
  --nsTo="meitu_staging.*" \
  prod-backup
```

Before restoring, confirm the restore URI is the staging URI.

## Feature Workflow

1. Start from the latest `main`.
2. Create a feature branch.
3. Use `Server/.env.staging` locally.
4. Test data changes only on the staging database.
5. Deploy the feature or `staging` branch to the Hostinger test domain.
6. Configure the test domain with staging MongoDB env vars.
7. Verify admin, dealer, dispatcher, order, and report flows.
8. Back up production.
9. Merge to `main`.
10. Deploy production.
11. Run a production migration/write only if needed and only with explicit safety flags.

## Hostinger Recommended Setup

Production app:

```text
Domain: meitupaintsnepal.com
Branch: main
MONGO_URI: production database
NODE_ENV: production
DB_ENV: production
ALLOW_PRODUCTION_DB_WRITE: false
ALLOW_DESTRUCTIVE_SEED: false
```

Staging app:

```text
Domain: test.meitupaintsnepal.com or staging.meitupaintsnepal.com
Branch: staging or feature branch
MONGO_URI: staging database
NODE_ENV: staging
DB_ENV: staging
ALLOW_PRODUCTION_DB_WRITE: false
ALLOW_DESTRUCTIVE_SEED: false
```

## Before Any Production Migration

Always back up first:

```bash
mongodump --uri="PRODUCTION_MONGO_URI" --out=backup-before-feature-name
```

Then run the smallest possible production write. Avoid full rewrite seeds on production. Prefer append or idempotent migrations.
