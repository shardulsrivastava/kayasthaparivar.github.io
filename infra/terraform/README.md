# Cloudflare infra for kayasthaparivar.com

Manages DNS for the custom domain that points at this repo's GitHub Pages
site, plus the Cloudflare zone SSL settings GitHub Pages needs.

## What this creates

- `@` (apex) CNAME → `kayasthaparivar.github.io`, proxied
- `www` CNAME → `kayasthaparivar.com`, proxied
- Zone SSL mode set to `full` (not "full (strict)" — GitHub Pages' cert
  isn't issued by a CA Cloudflare can strictly validate against), with
  HTTPS enforced
- A Cloudflare Worker (`infra/cloudflare-worker/turnstile-gate.js`) bound to
  every request on `kayasthaparivar.com/*` and `www.kayasthaparivar.com/*`,
  which gates the whole site behind a Cloudflare Turnstile challenge — see
  "Turnstile site gate" below
- `origin` CNAME → `kayasthaparivar.github.io`, **unproxied** (DNS only) —
  an implementation detail the gate Worker needs, not a hostname meant to
  be visited directly (see the comment in `turnstile.tf`)

## One-time setup

1. **Add the domain to Cloudflare** (if not already) and note the Zone ID
   from the zone's Overview page in the dashboard.
2. **Create an API token**: My Profile → API Tokens → Create Token, with
   `Zone:DNS:Edit` and `Zone:Zone Settings:Edit` permissions scoped to this
   one zone. Don't use your Global API Key.
3. **Copy the vars file**:
   ```sh
   cp terraform.tfvars.example terraform.tfvars
   # fill in cloudflare_zone_id
   ```
4. **Set the token as an env var** (never put it in a `.tfvars` file):
   ```sh
   export TF_VAR_cloudflare_api_token="your-token-here"
   ```
5. **In the GitHub repo settings** → Pages, set the custom domain to
   `kayasthaparivar.com` and (once DNS has propagated) enable "Enforce
   HTTPS". This step is manual — GitHub's Pages custom-domain verification
   isn't exposed as a Terraform resource.
6. **Find your Cloudflare account ID** (not the zone ID): dashboard →
   Workers & Pages → Overview, shown in the right-hand sidebar. This is
   needed for `cloudflare_account_id` (the Worker resource is
   account-scoped, not zone-scoped).

## Turnstile site gate — manual one-time setup

The gate itself (Worker script, routes, DNS plumbing) is all in Terraform,
but Turnstile widget keys can only be created by hand in the dashboard —
there's no Terraform resource for it in the pinned provider version, and it
requires a human decision (widget name, domain) that shouldn't be
automated. Before running `apply` with `turnstile.tf` included:

1. **Create a Turnstile widget**: dashboard → Turnstile → Add widget.
   - Widget mode: **Managed**.
   - Domain: `kayasthaparivar.com` (add `www.kayasthaparivar.com` too if
     the dashboard asks for it separately).
2. Copy the **Site Key** and **Secret Key** it gives you.
3. Generate a random session-signing secret (this is separate from the
   Turnstile keys — see "Why a signed cookie" below):
   ```sh
   openssl rand -hex 32
   ```
4. Set all three as Terraform variables — never commit any of them:
   ```sh
   export TF_VAR_turnstile_site_key="0x4AAAAAAA..."
   export TF_VAR_turnstile_secret_key="0x4AAAAAAA..."
   export TF_VAR_session_secret="<output of the openssl command above>"
   ```
   (or add them as `TF_VAR_turnstile_site_key` / `TF_VAR_turnstile_secret_key`
   / `TF_VAR_session_secret` CI secrets, same as `cloudflare_api_token`).
5. Run `terraform plan` / `terraform apply` as usual.

Once applied, every request to the domain is gated by the Worker until it
sees a valid `cf_turnstile_verified` cookie, which is only set after the
Worker verifies the Turnstile response server-side against Cloudflare's
siteverify API — see the comment block at the top of
`infra/cloudflare-worker/turnstile-gate.js` for how it avoids the
Worker-fetches-itself infinite loop that a naive origin pass-through would
hit.

### Why a signed cookie

This repo (including the Worker source) is public. The cookie is not just a
static marker like `cf_turnstile_verified=1` — anyone could read that value
in this file and set it by hand in their browser or a script, skipping
Turnstile forever. Instead the cookie value is
`<unix-timestamp>.<hmac-sha256>`, signed with the `SESSION_SECRET` binding
(`var.session_secret` in Terraform). A visitor can only get a valid cookie
by actually passing a Turnstile challenge, since only the Worker (which
holds the secret) can produce a signature that verifies — and the
timestamp is part of what's signed, so a copied cookie stops working once
`COOKIE_MAX_AGE_SECONDS` elapses, same as before.

**This cannot be end-to-end tested without a real deploy** (no sandbox
Cloudflare account/API access was available while building this). Terraform
plan/validate/fmt were run against the real provider schema with dummy
credentials and produced a clean plan (7 resources, no errors), which
confirms the resource types and arguments are accepted — but nothing was
applied. Once you do apply for real, check:

- Visit the site in an incognito/private window. You should see the
  Turnstile interstitial, not the real site.
- Solve the challenge. You should land back on the exact page you
  originally requested (including any path, not just the homepage).
- Reload the page — you should NOT be re-challenged (the cookie lasts 1 day
  by default; adjust `COOKIE_MAX_AGE_SECONDS` in the Worker script if you
  want it shorter/longer).
- Try both `kayasthaparivar.com` and `www.kayasthaparivar.com` — both
  routes should gate identically.
- Confirm a plain `curl -I https://kayasthaparivar.com/` (no cookie, no JS)
  gets the challenge page, not the real site — that's the actual bot
  deterrent working.
- Check Cloudflare dashboard → Workers & Pages → your worker → Metrics
  after some traffic, to sanity-check request volume against the 100k/day
  free tier.

## Running locally

```sh
terraform init
terraform plan
terraform apply
```

This works out of the box with Terraform's local state file. That's fine
for a single person applying changes from their own machine, but see
below before wiring this into CI.

## Before enabling the CI apply workflow

`terraform-apply.yml` (in `.github/workflows/`) runs `terraform apply` from
a GitHub Actions runner, which starts with a clean filesystem every time —
there's no local state to reuse. Applying with local state from CI would
mean every run starts from "nothing exists" and can fail trying to
recreate records that are already there.

Before you rely on the CI apply workflow, switch to a remote backend.
Terraform Cloud is the easiest option and has a free tier:

1. Create a free org at [app.terraform.io](https://app.terraform.io) and a
   workspace named `kayasthaparivar-site` (CLI-driven execution mode).
2. Uncomment the `cloud` block in `providers.tf` and set your org name.
3. Generate a Terraform Cloud API token and add it as a GitHub Actions
   secret named `TF_API_TOKEN`.
4. Add `CLOUDFLARE_API_TOKEN` and `TF_VAR_cloudflare_zone_id` as repo
   secrets too — the workflows reference them.
5. Run `terraform init` locally once more to migrate state into the new
   backend.

Until you've done this, treat `terraform-apply.yml` as something to trigger
manually with care, and double check `terraform plan` output first.
