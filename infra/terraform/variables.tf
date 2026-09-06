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
