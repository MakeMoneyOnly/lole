# =============================================================================
# lole Restaurant OS - Terraform Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Supabase Outputs
# -----------------------------------------------------------------------------

output "supabase_project_ref" {
  description = "Supabase project reference"
  value       = module.supabase.project_ref
  sensitive   = true
}

output "supabase_api_url" {
  description = "Supabase API URL"
  value       = module.supabase.api_url
}

output "supabase_database_host" {
  description = "Supabase database host"
  value       = module.supabase.database_host
}

output "supabase_database_port" {
  description = "Supabase database port"
  value       = module.supabase.database_port
}

output "supabase_jwt_secret" {
  description = "Supabase JWT secret"
  value       = module.supabase.jwt_secret
  sensitive   = true
}

output "supabase_service_key" {
  description = "Supabase service role key"
  value       = module.supabase.service_key
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Redis/Upstash Outputs
# -----------------------------------------------------------------------------

output "redis_rest_api_url" {
  description = "Upstash Redis REST API URL"
  value       = module.redis.redis_rest_api_url
  sensitive   = true
}

output "redis_rest_api_token" {
  description = "Upstash Redis REST API token"
  value       = module.redis.redis_rest_api_token
  sensitive   = true
}

output "redis_host" {
  description = "Redis host"
  value       = module.redis.redis_host
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.redis_port
}

output "redis_database_id" {
  description = "Upstash Redis database ID"
  value       = module.redis.redis_database_id
}

# -----------------------------------------------------------------------------
# Vercel Outputs
# -----------------------------------------------------------------------------

output "vercel_project_id" {
  description = "Vercel project ID"
  value       = module.vercel.project_id
}

output "vercel_project_url" {
  description = "Vercel project production URL"
  value       = module.vercel.project_url
}

output "vercel_deployment_id" {
  description = "Latest Vercel deployment ID"
  value       = module.vercel.deployment_id
}

# -----------------------------------------------------------------------------
# Combined Configuration Outputs
# -----------------------------------------------------------------------------

output "application_urls" {
  description = "Application URLs for different environments"
  value = {
    api        = module.supabase.api_url
    app        = module.vercel.project_url
    database   = module.supabase.database_host
  }
}

output "required_env_vars" {
  description = "List of required environment variables for the application"
  value = [
    "NEXT_PUBLIC_SUPABASE_URL=${module.supabase.api_url}",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=${module.supabase.anon_key}",
    # These should be set in Vercel project settings (not exposed here):
    # SUPABASE_SERVICE_ROLE_KEY
    # REDIS_REST_API_URL
    # REDIS_REST_API_TOKEN
  ]
}

output "terraform_state_note" {
  description = "Note about Terraform state management"
  value       = "Terraform state should be stored in a secure S3 bucket for production. Update main.tf backend configuration."
}
