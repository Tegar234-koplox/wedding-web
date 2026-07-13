# Staff MFA Rollout

## Objective

Protect staff login and require a recent second factor before publish, order mutation,
payment verification, rejection, or archive actions.

## Safe rollout order

1. Deploy the API and run migrations with `STAFF_MFA_REQUIRED=false`.
2. Log in as every active staff account and open `/admin/security`.
3. Enroll an authenticator, verify the six-digit code, and store the one-time recovery
   codes in the company password manager.
4. Log out and verify each account can complete password plus MFA login.
5. Confirm at least two owner-controlled recovery paths exist before enforcement.
6. Set `STAFF_MFA_REQUIRED=true` on Railway and redeploy.
7. Open `/admin/security` and perform step-up verification before sensitive operations.

Do not enable enforcement before enrollment. An unenrolled staff account cannot satisfy
the second factor and will be intentionally denied access.

## Runtime settings

```env
STAFF_MFA_REQUIRED=false
STAFF_MFA_CHALLENGE_TTL_SECONDS=300
STAFF_MFA_REAUTH_TTL_SECONDS=1800
DJANGO_SESSION_COOKIE_AGE=43200
```

The normal staff session is capped at 12 hours. Step-up authorization lasts 30 minutes
by default and does not extend merely because the dashboard remains open.

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
