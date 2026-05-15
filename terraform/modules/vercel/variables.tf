# =============================================================================
# Vercel Module Variables
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team ID"
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Vercel project name"
  type        = string
  default     = "lole"
}

variable "git_repo_url" {
  description = "Git repository URL"
  type        = string
  default     = ""
}

variable "git_repo_type" {
  description = "Git repository type (github, gitlab, bitbucket)"
  type        = string
  default     = "github"
}

variable "framework" {
  description = "Framework (nextjs, react, etc.)"
  type        = string
  default     = "nextjs"
}

variable "node_version" {
  description = "Node.js version"
  type        = string
  default     = "20"
}

variable "env_vars" {
  description = "Environment variables for the project"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "production_domains" {
  description = "Production domains"
  type        = list(string)
  default     = []
}

variable "enable_vercel_kv" {
  description = "Enable Vercel KV (serverless Redis)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
