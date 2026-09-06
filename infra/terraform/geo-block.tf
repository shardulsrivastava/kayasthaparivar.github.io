# Zero-cost WAF layer: this site's audience is concentrated in India, so
# block all traffic that doesn't originate there. This intentionally also
# blocks diaspora/NRI family members browsing from outside India — that
# tradeoff is accepted, not a bug.
resource "cloudflare_ruleset" "block_non_india" {
  zone_id     = var.cloudflare_zone_id
  name        = "Geo-restrict to India"
  description = "Custom WAF rules scoped to this zone's http_request_firewall_custom phase."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    description = "Block non-India traffic"
    expression  = "(ip.geoip.country ne \"IN\")"
    action      = "block"
    enabled     = true
  }
}
