variable "cloudflare_api_token" {
  description = "Cloudflare API token scoped to this zone (Zone:DNS:Edit, Zone:Zone Settings:Edit). Set via TF_VAR_cloudflare_api_token or CI secret — never commit this."
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Zone ID for the domain, found on the Cloudflare dashboard's zone overview page."
  type        = string
}

variable "domain" {
  description = "Apex domain managed by this configuration."
  type        = string
  default     = "kayasthaparivar.com"
}

variable "github_pages_target" {
  description = "The GitHub Pages hostname the domain should point at."
  type        = string
  default     = "kayasthaparivar.github.io"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Worker used for the Turnstile site gate (Workers & Pages -> Overview in the dashboard shows it)."
  type        = string
}

variable "turnstile_site_key" {
  description = "Cloudflare Turnstile widget site key. Public by design (it's embedded in the challenge page HTML), so no need to mark it sensitive. Created manually in the Cloudflare dashboard — see infra/terraform/README.md."
  type        = string
}

variable "turnstile_secret_key" {
  description = "Cloudflare Turnstile widget secret key, used server-side inside the Worker to verify challenge responses. Never commit this — set via TF_VAR_turnstile_secret_key or a CI secret. Created manually alongside the site key — see infra/terraform/README.md."
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "Random secret used inside the Worker to HMAC-sign the post-Turnstile session cookie. This repo (and the Worker script) is public, so the cookie's name and format are not secret — this key is what makes a cookie value unforgeable without it. Never commit this — set via TF_VAR_session_secret or a CI secret. Generate with e.g. `openssl rand -hex 32`; no default is provided on purpose."
  type        = string
  sensitive   = true
}
