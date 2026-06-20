# Architecture overview

The platform is a pnpm/Turborepo monorepo with independently deployable frontend and backend applications.

## Boundaries

- `apps/web` owns routing, presentation, accessibility, localized public pages, and audited invitation renderers.
- `apps/api` owns persistent business data, validation, permissions, integration calls, and asynchronous work.
- `packages/ui` owns visual tokens and reusable non-domain UI primitives.
- `packages/invitation-themes` owns renderer contracts and the versioned renderer registry.
- PostgreSQL is the source of truth. Redis is ephemeral cache and queue infrastructure.
- Cloudinary is the canonical media store; only safe asset metadata belongs in PostgreSQL.

## Security defaults

Public API serializers are separate from future staff serializers. Backend permissions default to deny. Secrets are server-only, environment-driven, and validated at startup. The browser never calls BMKG or signs Cloudinary uploads directly.

## Localization

Indonesian (`id`) and English (`en`) are supported from launch. Indonesian is the default and fallback locale.
