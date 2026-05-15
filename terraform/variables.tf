# =============================================================================
# lole Restaurant OS - Terraform Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Environment Configuration
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# Supabase Configuration
# -----------------------------------------------------------------------------

variable "supabase_project_ref" {
  description = "Supabase project reference (e.g., 'abc123def456')"
  type        = string
  default     = ""
  sensitive   = true
}

variable "supabase_project_id_prod" {
  description = "Supabase project ID for production"
  type        = string
  default     = ""
  sensitive   = true
}

variable "supabase_project_id_dev" {
  description = "Supabase project ID for development"
  type        = string
  default     = ""
  sensitive   = true
}

variable "supabase_db_password" {
  description = "Supabase database password (for initial setup)"
  type        = string
  sensitive   = true
}

variable "supabase_postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  default     = ""
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key (public)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key (secret - do not expose)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "auth_redirect_urls" {
  description = "Allowed redirect URLs for authentication"
  type        = list(string)
  default     = ["http://localhost:3000", "https://*.vercel.app"]
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------

variable "storage_max_file_size_mb" {
  description = "Maximum file size for storage uploads (MB)"
  type        = number
  default     = 50
}

# -----------------------------------------------------------------------------
# Vercel Configuration
# -----------------------------------------------------------------------------

variable "vercel_team_id" {
  description = "Vercel team ID"
  type        = string
  default     = ""
}

variable "vercel_project_name" {
  description = "Vercel project name"
  type        = string
  default     = "lole"
}

variable "vercel_project_url" {
  description = "Vercel project production URL"
  type        = string
  default     = ""
}

variable "git_repo_url" {
  description = "Git repository URL"
  type        = string
  default     = ""
}

variable "production_domains" {
  description = "Production domains for the application"
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Upstash/Redis Configuration
# -----------------------------------------------------------------------------

variable "upstash_email" {
  description = "Upstash account email"
  type        = string
  default     = ""
}

variable "upstash_team_id" {
  description = "Upstash team ID"
  type        = string
  default     = ""
}

variable "upstash_redis_rest_api_token" {
  description = "Upstash Redis REST API token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "upstash_redis_rest_api_url" {
  description = "Upstash Redis REST API URL"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Kubernetes Configuration (Optional - Self-hosted)
# -----------------------------------------------------------------------------

variable "kubernetes_cluster_name" {
  description = "Kubernetes cluster name for self-hosted deployment"
  type        = string
  default     = ""
}

variable "database_host" {
  description = "External database host (for self-hosted)"
  type        = string
  default     = ""
}

variable "database_port" {
  description = "External database port"
  type        = number
  default     = 5432
}

variable "database_name" {
  description = "External database name"
  type        = string
  default     = "lole"
}

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

variable "enable_graphql" {
  description = "Enable GraphQL API"
  type        = bool
  default     = false
}

variable "enable_realtime" {
  description = "Enable Supabase Realtime"
  type        = bool
  default     = true
}
