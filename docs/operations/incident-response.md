# Incident response

## Severity and ownership

- P0: confirmed data exposure, account takeover, credential leak, or total outage.
- P1: repeated 5xx, broken login/publish/RSVP, or sustained abuse with partial availability.
- P2: isolated defect with a workaround and no confidentiality impact.

The on-call owner records start time, release SHA, affected services, customer impact,
decisions, and evidence. Do not paste secrets or guest PII into tickets or chat.

## First 15 minutes

1. Stop risky deployments and preserve logs.
2. If abuse is active, enable Cloudflare managed challenge or block the narrowest rule.
3. If credentials may be exposed, revoke and rotate them before debugging convenience.
4. Roll back frontend/backend for release regressions; do not reverse database migrations
   without a verified restore point.
5. Disable affected staff accounts and reset sessions for suspected takeover.

## Scenario actions

- Credential leak: rotate Django, database, Redis, Cloudinary, Sentry, and tunnel secrets
  according to actual exposure; redeploy and verify old credentials fail.
- DDoS: Cloudflare challenge/rate rules first, then restrict Railway origin and scale only
  after confirming the traffic is legitimate.
- Data exposure: close the route, preserve audit/access logs, identify affected rows and
  recipients, and obtain legal/privacy advice before customer notification.
- Account takeover: disable account, clear sessions, reset MFA and password, inspect all
  mutation audit events, and revert unauthorized state changes transactionally.

## Recovery exit criteria

- Root cause is contained, smoke tests pass, alerts return to baseline, rotated secrets are
  verified, and a named owner approves restoration.
- Create a blameless incident review with corrective actions, owners, and due dates within
  two business days.
