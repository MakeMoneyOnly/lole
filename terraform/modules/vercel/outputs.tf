# =============================================================================
# Vercel Module Outputs
# =============================================================================

output "project_id" {
  description = "Vercel project ID"
  value       = vercel_project.lole.id
}

output "project_name" {
  description = "Vercel project name"
  value       = vercel_project.lole.name
}

output "project_url" {
  description = "Vercel project production URL"
  value       = vercel_project.lole.url
}

output "deployment_id" {
  description = "Latest deployment ID"
  value       = ""  # This would be populated after a deployment
}

output "deployment_url" {
  description = "Latest deployment URL"
  value       = ""  # This would be populated after a deployment
}

output "production_domains" {
  description = "Configured production domains"
  value       = [for domain in vercel_project_domain.production : domain.domain]
}

output "environment" {
  description = "Environment"
  value       = var.environment
}
