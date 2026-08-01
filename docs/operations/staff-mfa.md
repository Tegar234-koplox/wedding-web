# Staff MFA Rollout

## Objective

Protect staff login and require a recent second factor before publish, order mutation,
payment verification, rejection, or archive actions.

## Safe rollout order

Production now refuses to boot when `STAFF_MFA_REQUIRED` is false. At minimum,
complete enrollment for an active owner on the currently running release before
deploying this hardened release:

1. Log in as an active owner and open `/admin/security`.
2. Enroll an authenticator, verify the six-digit code, and store the one-time recovery
   codes in the company password manager.
3. Log out and verify the owner can complete password plus MFA login.
4. Confirm at least one active owner has a confirmed TOTP device and at least two
   owner-controlled recovery paths exist.
5. Set `STAFF_MFA_REQUIRED=true` on Railway and deploy the hardened release.
6. Confirm `/health/ready` reports `staff_mfa: ok`.
7. Open `/admin/security` and perform step-up verification before sensitive operations.

Do not deploy this release before at least one owner is enrolled: production
readiness intentionally remains `503` when no active owner has confirmed TOTP.
Other active staff may be enrolled in advance or use the first-login enrollment
flow after deployment. That flow accepts the password challenge, displays the
authenticator QR/URI once, confirms a TOTP code, then displays one-time recovery
codes. It never creates a staff session before successful confirmation.

## Runtime settings

```env
STAFF_MFA_REQUIRED=true
STAFF_MFA_CHALLENGE_TTL_SECONDS=300
STAFF_MFA_REAUTH_TTL_SECONDS=1800
DJANGO_SESSION_COOKIE_AGE=28800
STAFF_SESSION_ABSOLUTE_TTL_SECONDS=28800
STAFF_SESSION_IDLE_TTL_SECONDS=1800
STAFF_SESSION_TOUCH_INTERVAL_SECONDS=60
```

The hardened staff session is capped at 8 hours and expires after 30 minutes of
inactivity. Step-up authorization lasts 30 minutes by default and does not
extend merely because the dashboard remains open. Role, assignment, password,
or MFA changes revoke existing staff sessions.

## Recovery

- Use one unused recovery code in place of the authenticator code.
- After recovery access, reset MFA from the authenticated security workflow.
- A reset invalidates all devices and recovery codes and logs the staff account out.
- Never send recovery codes through WhatsApp, email, issue comments, or application logs.

Inspect lockouts with `python manage.py axes_list_attempts`. Use
`python manage.py axes_reset` only after verifying the staff identity and incident context;
the command clears all current attempts, so record the reason and operator first.

## Verification evidence

- Failed login responses do not reveal whether the username exists or has staff access.
- Login, MFA enrollment, recovery-code use, re-authentication, reset, and logout create
  `AuditEvent` records without storing raw credentials or MFA codes.
- Publish and destructive mutations return `403` when enforcement is enabled and the
  recent-MFA session marker is absent or expired.
