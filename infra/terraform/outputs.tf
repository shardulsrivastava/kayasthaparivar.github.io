output "apex_record" {
  description = "The apex DNS record pointing at GitHub Pages."
  value       = "${cloudflare_record.apex.name} -> ${cloudflare_record.apex.content}"
}

output "www_record" {
  description = "The www DNS record pointing at the apex domain."
  value       = "${cloudflare_record.www.name} -> ${cloudflare_record.www.content}"
}
