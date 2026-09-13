# BucketReef Frontend (React + Vite + Tailwind)

## Quickstart

```bash
npm install
npm run dev
```

The app expects the API at `/api` by default. In dev, Vite will proxy `/api` to `VITE_API_PROXY_TARGET` (defaults to `http://localhost:8000`).
Override with `VITE_API_URL` in a `.env` file at the project root:

```bash
VITE_API_URL=/api
VITE_API_PROXY_TARGET=http://localhost:8000
```

In Kubernetes, `/api` should be routed to the backend by the Ingress (or another reverse proxy).

## UI Quality Gates

Run the complete frontend quality pipeline:

```bash
npm run check
```

This executes:

- `npm run lint`
- `npm run typecheck`
- `npm run deadcode:check`
- `npm run test`
- `npm run build`
- `npm run chunks:check`
- `npm run budget:check`

The lint gate covers the complete `src` tree, including production code and
tests.

### Bundle baseline

Baseline captured before route-level lazy loading refactor (2026-02-28):

- Entry/primary runtime bundle reached ~2.65 MB minified (`dist/assets/index-CeF-w1y-.js`).
- Build emitted chunk-size warnings.

Post-refactor validation is enforced by `scripts/check-bundle-budget.mjs` using Vite manifest data.

Post-refactor measurements (2026-02-28):

- Entry chunk: `76.2 KB` (`assets/index-BTKkG_9K.js`)
- Largest chunk: `337.9 KB` (`assets/vendor-B9RtXmmQ.js`)
- Total JavaScript: `2.57 MB` across `114` chunks

Current budget calibration (2026-08-02):

- Entry chunk budget: `600 KiB`
- Largest chunk budget: `1,500 KiB`
- Total JavaScript budget: `3,750 KiB`
- Current validated build: entry `123.5 KB`, largest chunk `380.7 KB`, total JavaScript `3.62 MB` across `211` chunks

### UI review checklist

- Dialogs:
  `role="dialog"`, `aria-modal`, keyboard `Escape`, focus trap, and focus return on close.
- Menus/listboxes:
  correct ARIA roles, `aria-controls`, predictable keyboard navigation (`Arrow*`, `Home/End`, `Enter`, `Escape`, `Tab`).
- Responsive behavior:
  no topbar overflow on mobile; browser side panels disabled automatically on narrow viewports.
- Performance:
  route-level lazy loading preserved and bundle budget passing.

## App shell / theme
- Topbar + sidebar "console" layout with light/dark toggle (persisted in `localStorage`).
- Breadcrumbs + `PageHeader`/cards for each view; tables use the same dense style for Admin/Manager.

## Available pages (high level)
- Auth: Login (password, LDAP directory, RGW keys, or external OIDC providers such as Google) + Unauthorized page; OIDC callbacks handled under `/oidc/:provider/callback`.
- Admin area (`/admin/*`, role `ui_admin`):
  - Dashboard: real stats cards + accounts summary table.
  - Accounts: RGW admin ops (create/import accounts + quotas), users (CRUD) unchanged.
- Manager area (`/manager/*`, role `ui_user` or `ui_admin`):
  - Dashboard: account-scoped stats cards.
  - Buckets: list + delete + wizard de création multi-étapes (nom, versioning, block public access, Object Lock, tags), lien vers détail.
  - Bucket detail: onglets Overview / Objects (split view mock), Properties / Permissions / Metrics / Advanced (placeholders structurés).
  - IAM: Users/Groups/Roles/Policies pages exist, to be progressively refondus dans le nouveau shell.
- Portal area (`/portal/*`, role `ui_user` or `ui_admin` with explicit `portal_user`/`portal_manager` account link):
  - Dashboard: self-service buckets, access keys, usage, traffic, billing status, and endpoint health for an RGW IAM account.
  - Browser: object operations from Portal when `browser_portal_enabled` is enabled.

## Default login redirect
- `ui_admin` -> `/admin`
- `ui_user` -> `/manager` by default
- `ui_user` with only portal rights -> `/portal`
- `ui_none` or missing role -> `/unauthorized`

## Simplified Chinese localization

The existing `useI18n` message objects and `profileMessages` include `zh` for
Simplified Chinese. Keep translations alongside `en`, `fr` and `de`; no separate
translation service or dependency is required. Missing translations fall back
to English. `UiLanguage` and backend user API validation both accept `zh`, and
profile preferences persist it through the existing user settings API.

Automatic browser detection recognizes `zh`, `zh-CN`, `zh-SG` and `zh-Hans`.
Traditional Chinese locales continue to the next supported browser language.
The document language is `zh-Hans`; Portal regional formatting uses `zh-CN`
without changing the billing currency or timestamps.

Validate coverage and profile behavior with `npm run check`. Browser smoke
checks use isolated fixture API responses (no live storage credentials):

```bash
NO_PROXY=localhost,127.0.0.1 npx playwright test -c playwright.docs.config.ts chineseVisualQa.spec.ts
```

The browser check covers Portal routes, profile reload, the tool configuration
dialog, desktop/mobile widths and light/dark themes. It does not test real S3
operations. Existing English-only surfaces are outside this localization pass.
