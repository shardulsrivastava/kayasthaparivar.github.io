terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Local state by default so `terraform plan` works immediately with no
  # extra setup. Local state is NOT safe for the CI apply workflow (every
  # run would start from a blank slate and could try to recreate existing
  # DNS records). Before relying on automatic `terraform apply` in CI,
  # switch to a remote backend — Terraform Cloud has a free tier and needs
  # no infrastructure of its own:
  #
  # cloud {
  #   organization = "your-tfc-org"
  #   workspaces {
  #     name = "kayasthaparivar-site"
  #   }
  # }
  #
  # See infra/terraform/README.md for the full setup steps.
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
