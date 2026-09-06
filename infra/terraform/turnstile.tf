# Full-site Cloudflare Turnstile gate.
#
# GitHub Pages serves static files with no server of its own, so it cannot
# verify anything. This Worker runs on Cloudflare's edge (already in front
# of the domain, since DNS is proxied) and does the actual gating: visitors
# without a valid signed cookie get an interstitial Turnstile challenge, and
# the challenge response is verified server-side, inside the Worker, against
# Cloudflare's siteverify API before the cookie is ever set. A client-JS-only
# "set localStorage after solving Turnstile" gate would not survive contact
# with a scripted bot; this does, because the check happens before any
# origin content is ever served.
#
# See infra/cloudflare-worker/turnstile-gate.js for the Worker source and a
# detailed explanation of the resolveOverride trick used to avoid the Worker
# route re-intercepting its own pass-through requests to origin.

# In-zone DNS record the Worker resolves against when proxying an
# already-verified request to the real GitHub Pages origin. `resolveOverride`
# only takes effect when both the fetched URL's host and the override host
# are in the same Cloudflare zone, so a direct override to
# `kayasthaparivar.github.io` (a different zone) is silently ignored and the
# Worker ends up re-triggering its own route — infinite recursion. Creating
# this record inside our own zone gives resolveOverride a same-zone target
# that ultimately points at GitHub's origin. It must stay DNS-only
# (unproxied): it's not meant to be a browsable hostname, and proxying it
# would put it back behind (and re-trigger) the very Worker route it exists
# to bypass.
resource "cloudflare_record" "worker_origin" {
  zone_id = var.cloudflare_zone_id
  name    = "origin"
  type    = "CNAME"
  content = var.github_pages_target
  proxied = false
  ttl     = 300
}

# The Worker script itself. Bindings supply the Turnstile keys and the
# session-signing secret at runtime — the site key is public (embedded in
# the challenge page HTML anyway) so a plain_text_binding is fine; the two
# secrets use secret_text_binding, which the provider treats as sensitive
# and never prints in plan/apply output.
#
# SESSION_SECRET is deliberately separate from TURNSTILE_SECRET_KEY: it
# signs the post-challenge session cookie (see hasValidSessionCookie() /
# signValue() in turnstile-gate.js) rather than talking to Cloudflare's
# siteverify API. Keeping them distinct means rotating one doesn't affect
# the other, and a leak of one key doesn't compromise the other's purpose.
resource "cloudflare_workers_script" "turnstile_gate" {
  account_id = var.cloudflare_account_id
  name       = "turnstile-site-gate"
  content    = file("${path.module}/../cloudflare-worker/turnstile-gate.js")
  module     = true

  plain_text_binding {
    name = "TURNSTILE_SITE_KEY"
    text = var.turnstile_site_key
  }

  secret_text_binding {
    name = "TURNSTILE_SECRET_KEY"
    text = var.turnstile_secret_key
  }

  secret_text_binding {
    name = "SESSION_SECRET"
    text = var.session_secret
  }
}

# Attach the Worker to every request on the apex and www hosts. Routes are
# matched independently per hostname pattern, so both are needed even though
# they point at the same script.
resource "cloudflare_workers_route" "apex" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "${var.domain}/*"
  script_name = cloudflare_workers_script.turnstile_gate.name
}

resource "cloudflare_workers_route" "www" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "www.${var.domain}/*"
  script_name = cloudflare_workers_script.turnstile_gate.name
}
