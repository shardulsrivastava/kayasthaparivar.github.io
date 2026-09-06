# Cloudflare infra for kayasthaparivar.com

Manages DNS for the custom domain that points at this repo's GitHub Pages
site, plus the Cloudflare zone SSL settings GitHub Pages needs.

## What this creates

- `@` (apex) CNAME → `kayasthaparivar.github.io`, proxied
- `www` CNAME → `kayasthaparivar.com`, proxied
- Zone SSL mode set to `full` (not "full (strict)" — GitHub Pages' cert
  isn't issued by a CA Cloudflare can strictly validate against), with
  HTTPS enforced
- A WAF custom rule (`geo-block.tf`) that hard-blocks all traffic from
  outside India — intentional given the site's audience, but it also blocks
  diaspora/NRI family members browsing from abroad, so don't be surprised

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
