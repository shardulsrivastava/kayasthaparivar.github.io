# Apex domain -> GitHub Pages, using Cloudflare's CNAME flattening.
resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "CNAME"
  content = var.github_pages_target
  proxied = true
  ttl     = 1 # required to be 1 ("automatic") when proxied
}

# www -> apex, also proxied.
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  content = var.domain
  proxied = true
  ttl     = 1
}

# GitHub Pages issues its own TLS certificate for the custom domain, so
# Cloudflare must not require strict validation against it.
resource "cloudflare_zone_settings_override" "this" {
  zone_id = var.cloudflare_zone_id
  settings {
    ssl                      = "full"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    automatic_https_rewrites = "on"
  }
}
