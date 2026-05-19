# Environment Variables Reference

**Version:** 1.0  
**Last Updated:** 2026-05-15  
**Status:** Enterprise Standard

---

## Overview

This document provides the definitive reference for all environment variables used in the lole Restaurant Operating System. Variables are organized by category, with clear descriptions, defaults, and security classifications.

---

## Security Classification Legend

| Symbol | Classification | Description                              |
| ------ | -------------- | ---------------------------------------- |
| 🔒     | Secret         | Cryptographic secrets, API keys          |
| ⚠️     | Sensitive      | Contains PII/business data, restrict access |
| 📦     | Public         | Safe to commit, non-sensitive configuration |
| 🛠️     | Tool           | Development/CI configuration             |

---

## Core Application Variables

### Supabase Configuration

| Variable                           | Description                             | Format            | Example                                   | Required    | Security |
| ---------------------------------- | --------------------------------------- | ----------------- | ----------------------------------------- | ----------- | -------- |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client-side anonymous access key      | JWT token         | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | 🔒 Yes      | Public   |
| `SUPABASE_SECRET_KEY`              | Server-side admin access key            | JWT token         | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | 🔒 Yes      | Secret   |
| `SUPABASE_ACCESS_TOKEN`            | Supabase CLI/personal access token    | JWT token         | `sbp_abc123...`                           | 🔒 Yes      | Secret   |
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase project API endpoint           | HTTPS URL         | `https://abc123.supabase.co`              | 🔒 Yes      | Public   |
| `SUPABASE_PROJECT_REF`             | Supabase project reference ID           | UUID alphanumeric | `abc123def456`                            | 🔒 Yes      | Public   |
| `SUPABASE_DB_PASSWORD`             | Direct database password                | Alphanumeric      | `securePassword123`                       | 🔒 Optional | Secret   |
| `DATABASE_URL`                     | Primary PostgreSQL connection string    | Connection string | `postgresql://...`                        | ⚠️ Recommended | Secret   |
| `DATABASE_POOL_URL`                | Pooled connection for serverless        | Connection string | `postgresql://...`                        | 📦 Optional   | Secret   |
| `DIRECT_URL`                       | Direct database connection              | Connection string | `postgresql://...`                        | ⚠️ For migrations | Secret   |

---

### PowerSync Configuration

| Variable           | Description                    | Format    | Required | Security |
| ------------------ | ------------------------------ | --------- | -------- | -------- |
| `POWERSYNC_URL`    | PowerSync service endpoint     | HTTPS URL | 🔒 Yes   | Public   |
| `POWERSYNC_TOKEN`  | PowerSync authentication token | JWT       | 🔒 Yes   | Secret   |
| `POWERSYNC_SCHEMA` | PowerSync schema name          | String    | 📦 No    | Public   |

---

## Caching & Redis

### Upstash Redis

| Variable                   | Description                      | Format    | Required       | Security |
| -------------------------- | -------------------------------- | --------- | -------------- | -------- |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis HTTP endpoint      | HTTPS URL | ⚠️ Recommended | Public   |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis bearer token       | UUID      | ⚠️ Recommended | Secret   |
| `REDIS_URL`                | Standard Redis connection string | rediss:// | 📦 Alternative | Secret   |

### Cache Settings

| Variable           | Description                     | Default | Required | Security |
| ------------------ | ------------------------------- | ------- | -------- | -------- |
| `CACHE_TTL_SHORT`  | Short-lived cache TTL (seconds) | `300`   | 📦 No    | Public   |
| `CACHE_TTL_MEDIUM` | Medium cache TTL (seconds)      | `3600`  | 📦 No    | Public   |
| `CACHE_TTL_LONG`   | Long cache TTL (seconds)        | `86400` | 📦 No    | Public   |

---

## External Services

### Payment Providers

| Variable               | Description                      | Format | Required          | Security |
| ---------------------- | -------------------------------- | ------ | ----------------- | -------- |
| `TELEBIRR_APP_ID`      | Telebirr merchant application ID | String | 🔒 For production | Secret   |
| `TELEBIRR_APP_KEY`     | Telebirr application key         | String | 🔒 For production | Secret   |
| `TELEBIRR_PUBLIC_KEY`  | Telebirr verification key        | PEM    | 🔒 For production | Public   |
| `TELEBIRR_MERCHANT_ID` | Telebirr merchant identifier     | String | 🔒 For production | Public   |
| `CHAPPA_API_KEY`       | Chappa payment gateway key       | String | ⚠️ Optional       | Secret   |

### SMS & Notifications

| Variable              | Description                 | Format       | Required    | Security |
| --------------------- | --------------------------- | ------------ | ----------- | -------- |
| `COURIER_AUTH_TOKEN`  | Courier API authentication  | Bearer token | ⚠️ Optional | Secret   |
| `TWILIO_ACCOUNT_SID`  | Twilio account identifier   | String       | ⚠️ Optional | Public   |
| `TWILIO_AUTH_TOKEN`   | Twilio authentication token | String       | ⚠️ Optional | Secret   |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone         | E.164 format | ⚠️ Optional | Public   |

---

## Infrastructure & Deployment

### Vercel Configuration

| Variable            | Description                    | Default | Required | Security |
| ------------------- | ------------------------------ | ------- | -------- | -------- |
| `VERCEL_ORG_ID`     | Vercel organization identifier | String  | 🛠️ CI/CD | Public   |
| `VERCEL_PROJECT_ID` | Vercel project identifier      | String  | 🛠️ CI/CD | Public   |
| `VERCEL_TOKEN`      | Vercel deployment token        | String  | 🛠️ CI/CD | Secret   |

### Feature Flags

| Variable                           | Description               | Default | Required | Security |
| ---------------------------------- | ------------------------- | ------- | -------- | -------- |
| `NEXT_PUBLIC_FF_TELEBIRR_ENABLED`  | Telebirr integration flag | `true`  | 📦 Yes   | Public   |
| `NEXT_PUBLIC_FF_DELIVERY_ENABLED`  | Delivery module flag      | `false` | 📦 Yes   | Public   |
| `NEXT_PUBLIC_FF_KDS_SOUND_ENABLED` | KDS audio alerts          | `true`  | 📦 No    | Public   |

---

## Development Environment

### Local Development

| Variable                  | Description               | Default       | Required       | Security |
| ------------------------- | ------------------------- | ------------- | -------------- | -------- |
| `NODE_ENV`                | Runtime environment       | `development` | 📦 Yes         | Public   |
| `PORT`                    | Local server port         | `3000`        | 📦 No          | Public   |
| `LOG_LEVEL`               | Logging verbosity         | `debug`       | 📦 No          | Public   |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1`           | 📦 Recommended | Public   |

### Testing

| Variable              | Description              | Default                 | Required   | Security |
| --------------------- | ------------------------ | ----------------------- | ---------- | -------- |
| `PLAYWRIGHT_TEST_URL` | Test server URL          | `http://localhost:3000` | 🛠️ Testing | Public   |
| `TEST_DATABASE_URL`   | Test database connection | Separate DB             | 🛠️ Testing | Secret   |
| `MOCK_PAYMENTS`       | Mock payment responses   | `true`                  | 🛠️ Testing | Public   |

---

## Monitoring & Analytics

### Sentry

| Variable            | Description              | Required      | Security |
| ------------------- | ------------------------ | ------------- | -------- |
| `SENTRY_DSN`        | Sentry data source name  | ⚠️ Production | Secret   |
| `SENTRY_ORG`        | Sentry organization slug | ⚠️ Production | Public   |
| `SENTRY_PROJECT`    | Sentry project slug      | ⚠️ Production | Public   |
| `SENTRY_AUTH_TOKEN` | Sentry CLI token         | ⚠️ CI/CD      | Secret   |

### Logging

| Variable        | Description           | Default           | Required      | Security |
| --------------- | --------------------- | ----------------- | ------------- | -------- |
| `AXIOM_DATASET` | Axiom logging dataset | `lole-production` | ⚠️ Production | Public   |
| `AXIOM_TOKEN`   | Axiom API token       | String            | ⚠️ Production | Secret   |

---

## Compliance & Legal

### ERCA Integration

| Variable              | Description                          | Required      | Security |
| --------------------- | ------------------------------------ | ------------- | -------- |
| `ERCA_API_URL`        | Ethiopian Revenue authority endpoint | 🔒 Production | Public   |
| `ERCA_CLIENT_ID`      | ERCA integration client ID           | 🔒 Production | Public   |
| `ERCA_CLIENT_SECRET`  | ERCA integration secret              | 🔒 Production | Secret   |
| `ERCA_SIGNATURE_CERT` | Digital signature certificate        | 🔒 Production | Secret   |

### Audit Trail

| Variable               | Description                | Required  | Security |
| ---------------------- | -------------------------- | --------- | -------- | ------ |
| `AUDIT_LOG_LEVEL`      | Audit logging verbosity    | `minimal` | 📦 No    | Public |
| `AUDIT_RETENTION_DAYS` | Audit log retention period | `365`     | 📦 No    | Public |

---

## Schema Reference

```yaml
# .env.example
# Supabase
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_ACCESS_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=
DATABASE_URL=
DATABASE_POOL_URL=
DIRECT_URL=

# PowerSync
POWERSYNC_URL=
POWERSYNC_TOKEN=

# Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Payments
TELEBIRR_APP_ID=
TELEBIRR_APP_KEY=
TELEBIRR_PUBLIC_KEY=
TELEBIRR_MERCHANT_ID=
```

---

## Security Best Practices

1. **Never commit secrets** to version control
2. Use `.env.local` for local overrides
3. Rotate keys quarterly or after incidents
4. Use environment-specific values for all tenants
5. Audit access logs for sensitive variable usage

---

## Environment Matrix

| Environment | Database     | API Keys  | Feature Flags | Logging |
| ----------- | ------------ | --------- | ------------- | ------- |
| Development | Local/Docker | Sandbox   | All enabled   | Verbose |
| Staging     | Staging DB   | Test keys | Prod-like     | Normal  |
| Production  | Production   | Live keys | As configured | Minimal |

---

## Validation Checklist

Before deployment, verify:

- [ ] All `🔒 Required` variables are set
- [ ] No development URLs in production
- [ ] Secrets match between environments
- [ ] Feature flags are correctly configured
- [ ] Payment keys are production-ready
