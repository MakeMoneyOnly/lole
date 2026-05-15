# =============================================================================
# Redis Module Variables
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

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

variable "redis_maxmemory_policy" {
  description = "Redis maxmemory policy"
  type        = string
  default     = "allkeys-lru"

  validation {
    condition     = contains([
      "noeviction", "allkeys-lru", "allkeys-random",
      "volatile-lru", "volatile-random", "volatile-ttl"
    ], var.redis_maxmemory_policy)
    error_message = "Invalid maxmemory policy"
  }
}

variable "enable_cluster_mode" {
  description = "Enable Redis cluster mode (production)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
