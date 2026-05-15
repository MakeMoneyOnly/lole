# =============================================================================
# Supabase Module Variables
# ==============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "supabase_project_ref" {
  description = "Supabase project reference"
  type        = string
  default     = ""
}

variable "database_password" {
  description = "Database password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "auth_site_url" {
  description = "Site URL for authentication"
  type        = string
  default     = "http://localhost:3000"
}

variable "auth_redirect_urls" {
  description = "Allowed redirect URLs"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "storage_max_file_size_mb" {
  description = "Maximum file size for storage (MB)"
  type        = number
  default     = 50
}

variable "enable_auth" {
  description = "Enable authentication"
  type        = bool
  default     = true
}

variable "enable_storage" {
  description = "Enable storage"
  type        = bool
  default     = true
}

variable "enable_realtime" {
  description = "Enable realtime"
  type        = bool
  default     = true
}

variable "enable_edge_functions" {
  description = "Enable edge functions"
  type        = bool
  default     = true
}

variable "plan_type" {
  description = "Supabase plan type (free, pro, team)"
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "pro", "team", "enterprise"], var.plan_type)
    error_message = "Plan type must be one of: free, pro, team, enterprise"
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
