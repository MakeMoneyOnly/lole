# =============================================================================
# Vercel Module
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Vercel Project
# -----------------------------------------------------------------------------

resource "vercel_project" "lole" {
  name = var.project_name

  # Git repository integration
  git_repository = var.git_repo_url != "" ? {
    type = var.git_repo_type
    repo = var.git_repo_url
  } : null

  # Framework and build settings
  framework         = var.framework
  node_version     = var.node_version

  # Build settings
  build_settings {
    # Next.js specific settings
    # These are configured in next.config.ts
    output_directory = ".next"
    install_command  = "pnpm install"
    build_command    = "pnpm build"
  }

  # Protect production deployments
  protect_production = var.environment == "production"

  # Tags
  tags = ["lole", var.environment]
}

# -----------------------------------------------------------------------------
# Environment Variables
# -----------------------------------------------------------------------------

resource "vercel_project_environment_variable" "public_vars" {
  for_each = var.env_vars

  project_id = vercel_project.lole.id
  key        = each.key
  value      = each.value
  target     = ["production", "preview", "development"]
}

# -----------------------------------------------------------------------------
# Production Domains
# -----------------------------------------------------------------------------

resource "vercel_project_domain" "production" {
  for_each = toset(var.production_domains)

  project_id = vercel_project.lole.id
  domain     = each.value

  # Enable Vercel Edge Network
  git_gateway {
    enabled = false
  }
}

# -----------------------------------------------------------------------------
# Vercel Analytics (Optional)
# -----------------------------------------------------------------------------

# Note: Vercel Analytics requires a paid plan
# Uncomment if needed:
# resource "vercel_project_analytics" "lole" {
#   project_id = vercel_project.lole.id
# }

# -----------------------------------------------------------------------------
# Vercel KV (Optional - for serverless Redis)
# -----------------------------------------------------------------------------

# If using Vercel KV instead of standalone Redis:
# resource "vercel_kv" "lole" {
#   count = var.enable_vercel_kv ? 1 : 0
#   name  = "lole-${var.environment}"
#   team_id = var.vercel_team_id
# }

# -----------------------------------------------------------------------------
# Deployment Protection (Production)
# -----------------------------------------------------------------------------

resource "vercel_project_deployment_protection" "production" {
  count = var.environment == "production" ? 1 : 0

  project_id = vercel_project.lole.id

  # Configure protection settings
  setting {
    deploy_lock_enabled = false
    deploy_lock_users   = []
  }
}
