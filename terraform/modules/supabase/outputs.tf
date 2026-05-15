# =============================================================================
# Supabase Module Outputs
# =============================================================================

output "project_ref" {
  description = "Supabase project reference"
  value       = var.supabase_project_ref
  sensitive   = true
}

output "api_url" {
  description = "Supabase API URL"
  value       = "https://${var.supabase_project_ref}.supabase.co"
}

output "database_host" {
  description = "Supabase database host"
  value       = "${var.supabase_project_ref}.supabase.co"
}

output "database_port" {
  description = "Supabase database port"
  value       = 5432
}

output "jwt_secret" {
  description = "Supabase JWT secret"
  # This would be retrieved from Supabase project settings
  # In practice, it's managed by Supabase and should be obtained from their dashboard
  value       = ""  # To be filled from Supabase dashboard
  sensitive   = true
}

output "service_key" {
  description = "Supabase service role key"
  value       = ""  # To be filled from Supabase dashboard
  sensitive   = true
}

output "anon_key" {
  description = "Supabase anonymous key (public)"
  value       = ""  # To be filled from Supabase dashboard
  sensitive   = true
}

output "storage_buckets" {
  description = "Created storage buckets"
  value = {
    avatars     = "avatars"
    receipts    = "receipts"
    menu_images = "menu-images"
  }
}

output "auth_config" {
  description = "Authentication configuration"
  value = {
    site_url        = var.auth_site_url
    redirect_urls   = var.auth_redirect_urls
    enable_signup   = var.enable_auth
  }
}
