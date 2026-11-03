# 02 — Service setup (exact procedures)

Do these in order. Each section ends with the variable names (see
`seo-engine/.env.example`) and where they go: your local `.env` for local
runs, **GitHub repository secrets** for the monthly pipeline, and **Vercel
environment variables** for the dashboard.

## 0. Prerequisites

- Node 22 and pnpm installed locally; this repo installs and builds.
- Owner access to the `craftui.space` Search Console property (you have it).
- Admin access to the PostHog project (US cloud).
- Admin on this GitHub repo and on the Vercel project.
- A card for DataForSEO prepayment.

## 1. Google Cloud + Search Console

1. https://console.cloud.google.com → create project `seo-engine` (or reuse one).
2. **APIs & Services → Library** → search **Google Search Console API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account**, name
   `seo-engine`, no roles, **Done**.
4. Open it → **Keys → Add key → Create new key → JSON**. Save outside the
   repo (for example `~/.secrets/seo-engine-gsc.json`). Never commit it.
5. Copy `client_email` from the JSON.
6. https://search.google.com/search-console → property `craftui.space` →
   **Settings → Users and permissions → Add user** → paste the email →
   permission **Owner** (needed for sitemap submission).

Values: `GOOGLE_APPLICATION_CREDENTIALS` (local path), `GSC_PROPERTY=sc-domain:craftui.space`.
GitHub secret and Vercel variable `GOOGLE_SERVICE_ACCOUNT_JSON` = full JSON text.

## 2. PostHog

1. **Settings → Project → General** → copy **Project ID**.
2. Host is `https://us.posthog.com`.
3. **Settings → User → Personal API keys → Create**: label `seo-engine`,
   scopes `query:read` + `project:read`, access limited to the craftUI
   project. Copy the `phx_` key once.

Values: `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_KEY`.
GitHub secret: `POSTHOG_API_KEY`. The dashboard does not need it.

## 3. DataForSEO

1. https://app.dataforseo.com/register, then **Billing** → add a small
   prepaid amount.
2. **API Access** → copy API login (email) and generate the **API
   password**.
3. Location: United States `2840`, language `en` (change if the target
   market differs; `GET /v3/serp/google/locations` lists codes).
4. Use `https://sandbox.dataforseo.com/v3` until the first dry run has
   been reviewed.

Values: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `DATAFORSEO_BASE_URL`,
`DATAFORSEO_LOCATION_CODE`, `DATAFORSEO_LANGUAGE_CODE`.
GitHub secrets: login and password.

## 4. Anthropic

1. https://console.anthropic.com → **API Keys → Create Key** `seo-engine`.
2. **Settings → Limits** → monthly spend limit (suggested $20).

Values: `ANTHROPIC_API_KEY`, `SEO_MODEL_FAST=claude-haiku-5-5`,
`SEO_MODEL_PLAN=claude-sonnet-5-5`. GitHub secret: the key.

## 5. IndexNow

1. Generate a key (8 to 128 characters, letters, digits, dashes):
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```
2. Add `public/<key>.txt` to this repo containing only the key. After
   deploy, `https://www.craftui.space/<key>.txt` must return it.

Value: `INDEXNOW_KEY` on Vercel (the dashboard's submit action uses it).

## 6. GitHub token for the dashboard's Run now button

1. https://github.com/settings/personal-access-tokens → **Generate new
   token** (fine-grained), name `seo-engine-dispatch`, 1 year.
2. Repository access: only `craftUI-Pro`. Permissions: **Actions: Read and
   write**, Metadata: Read.

Value: `SEO_GITHUB_TOKEN` on Vercel only. The pipeline itself uses the
workflow's built-in `GITHUB_TOKEN` (needs `issues: write` to open failure
issues).

## 7. MongoDB

Nothing new. The pipeline uses the same `MONGODB_URI` as the site. Add it
as a GitHub secret `MONGODB_URI` so Actions can write runs. Atlas network
access must allow GitHub's runners; the simplest is the `0.0.0.0/0` rule
the `.env.example` already mentions for Vercel.

## 8. Where each value goes

| Variable | Local `.env` | GitHub secret | Vercel |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | (use the path variable instead) | yes | yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | yes | set by workflow | no |
| `GSC_PROPERTY` | yes | variable | yes |
| `POSTHOG_HOST`, `POSTHOG_PROJECT_ID` | yes | variable | no |
| `POSTHOG_API_KEY` | yes | yes | no |
| `DATAFORSEO_*` | yes | login+password secret, rest variables | no |
| `ANTHROPIC_API_KEY` | yes | yes | no |
| `SEO_MODEL_*` | yes | variable | no |
| `MONGODB_URI` | yes (exists) | yes | yes (exists) |
| `INDEXNOW_KEY` | no | no | yes |
| `SEO_GITHUB_TOKEN` | no | no | yes |
| `SEO_DRY_RUN`, caps | yes | workflow input | no |

## Checklist

- [ ] Google Cloud project, API enabled, service account JSON saved
- [ ] Service account added as Owner on `craftui.space`
- [ ] PostHog project ID and `phx_` key
- [ ] DataForSEO funded, API password, location chosen
- [ ] Anthropic key with spend limit
- [ ] IndexNow key generated and `public/<key>.txt` added
- [ ] Fine-grained token for workflow dispatch
- [ ] GitHub secrets and variables set
- [ ] Vercel variables set
- [ ] `seo-engine/config/personas.md` written
- [ ] `seo-engine/sources/` populated with marketing-safe product material
