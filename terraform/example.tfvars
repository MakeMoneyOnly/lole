# =============================================================================
# Example Terraform Variables File
# =============================================================================
# Copy this to terraform/dev.tfvars, terraform/staging.tfvars, or 
# terraform/production.tfvars and fill in the values
# DO NOT commit this file with actual secrets
# =============================================================================

# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------
environment = "development"

# AWS Region
aws_region = "us-east-1"

# -----------------------------------------------------------------------------
# Supabase Configuration
# -----------------------------------------------------------------------------
# Get these from your Supabase project dashboard

# For development
supabase_project_id_dev = "your-dev-project-ref"
supabase_url           = "https://your-dev-project-ref.supabase.co"
supabase_anon_key      = "your-dev-anon-key"

# For production
supabase_project_id_prod = "your-prod-project-ref"

# Database password (only for initial setup)
# supabase_db_password = "your-database-password"

# -----------------------------------------------------------------------------
# Vercel Configuration
# -----------------------------------------------------------------------------

vercel_project_name = "lole"
git_repo_url        = "https://github.com/your-org/lole"

# Production domains (for production environment)
# production_domains = ["lole.com", "www.lole.com"]

# -----------------------------------------------------------------------------
# Upstash/Redis Configuration
# -----------------------------------------------------------------------------
# Get these from your Upstash console

# For Upstash Redis:
# upstash_redis_rest_api_url  = "https://your-database.upstash.io"
# upstash_redis_rest_api_token = "your-rest-api-token"

# For AWS ElastiCache (production):
# enable_cluster_mode = true

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------
enable_graphql  = false
enable_realtime = true
