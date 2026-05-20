# Error Monitoring Setup

## Current Sentry Configuration

Sentry is configured via the following environment variables:

| Variable                 | Required | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | Yes      | Public DSN for client-side error capture |
| `SENTRY_ORG`             | Yes      | Sentry organization slug                 |
| `SENTRY_PROJECT`         | Yes      | Sentry project name                      |
| `SENTRY_AUTH_TOKEN`      | Yes      | Auth token for source map uploads        |

## Verifying Sentry is Working

### Client-Side Verification

1. Open browser console
2. Run: `Sentry.captureMessage('Test message')`
3. Check Sentry dashboard for the test event

### Server-Side Verification

```javascript
// Test API route
import * as Sentry from '@sentry/nextjs';

export default function handler(req, res) {
    Sentry.captureException(new Error('Test server error'));
    res.status(200).json({ status: 'error sent' });
}
```

### Health Check Endpoint

Visit `/api/monitoring/sentry-health` to verify connectivity.

## Error Boundary Best Practices

### Client-Side Boundaries

```tsx
import { ErrorBoundary } from '@sentry/nextjs';

// Wrap critical routes
<ErrorBoundary fallback={<ErrorPage />}>
    <App />
</ErrorBoundary>;
```

### Server-Side Error Handling

```typescript
// API routes should use Sentry's captureException
try {
    // risky operation
} catch (error) {
    Sentry.captureException(error);
    throw error;
}
```

### Key Principles

- Never swallow errors silently
- Include context in error reports:
    ```typescript
    Sentry.setTag('userId', user.id);
    Sentry.setContext('page', { url: window.location.href });
    ```
- Use breadcrumbs for user journey tracking
- Release tracking must be configured for accurate issue correlation

## Recommended Dashboards

### Production Dashboard

Widgets to include:

1. Error volume trend (24h)
2. Top 5 issues by occurrence
3. Affected users count
4. Release health (crash-free rate)

### Performance Dashboard

- Page load time distribution
- Slowest API endpoints
- Database query performance
- Third-party API latency

## Alert Configuration

### Critical Alerts

| Alert       | Condition         | Threshold                  |
| ----------- | ----------------- | -------------------------- |
| Error Spike | Error volume      | 200% increase in 5 minutes |
| New Issue   | First occurrence  | Any new issue              |
| Crash Rate  | Sessions crashing | >5% in 10 minutes          |

### Notification Channels

- Critical: PagerDuty → On-call engineer
- Warning: Slack #ops-alerts
- Info: Slack #dev-notifications

## Source Map Uploads

Ensure `SENTRY_AUTH_TOKEN` has `project:write` scope. Source maps are uploaded automatically during Vercel build via `postBuildCommand` in `next.config.js`.
