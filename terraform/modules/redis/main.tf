# =============================================================================
# Redis/Upstash Module
# =============================================================================

terraform {
  required_version = ">= 1.6.0"
}

# -----------------------------------------------------------------------------
# Upstash Redis Database
# -----------------------------------------------------------------------------

# Note: Upstash provides a managed Redis service
# The Terraform provider for Upstash allows creating and managing Redis databases

# For Upstash, we'll use the REST API to create the database
# and manage configuration through environment variables

# Alternative: If using AWS ElastiCache instead:
resource "aws_elasticache_subnet_group" "lole" {
  count = var.enable_cluster_mode ? 1 : 0
  name       = "lole-${var.environment}-subnet"
  subnet_ids = []  # Configure with your VPC subnet IDs

  tags = var.tags
}

resource "aws_elasticache_parameter_group" "lole" {
  count = var.enable_cluster_mode ? 1 : 0
  name   = "lole-${var.environment}-params"

  # Redis 7.x configuration
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = var.redis_maxmemory_policy
  }

  tags = var.tags
}

resource "aws_elasticache_replication_group" "lole" {
  count = var.enable_cluster_mode ? 1 : 0

  replication_group_id       = "lole-${var.environment}"
  replication_group_description = "lole Redis Cluster - ${var.environment}"

  # Node configuration
  node_type               = var.enable_cluster_mode ? "cache.t3.medium" : "cache.t3.micro"
  number_cache_clusters   = var.enable_cluster_mode ? 2 : 1
  multi_az_enabled        = var.enable_cluster_mode

  # Engine configuration
  engine               = "redis"
  engine_version       = "7.0"
  port                = 6379
  parameter_group_name = aws_elasticache_parameter_group.lole[0].name

  # Network configuration
  subnet_group_name         = aws_elasticache_subnet_group.lole[0].name
  # security_group_ids = []  # Configure with your security groups

  # Backup configuration
  automatic_failover_enabled                = var.enable_cluster_mode
  multi_az_enabled                         = var.enable_cluster_mode
  auto_minor_version_upgrade               = true
  at_rest_encryption_enabled               = var.environment == "production"
  transit_encryption_enabled               = var.environment == "production"
  auth_token_enabled                       = var.environment == "production"

  # Maintenance
  maintenance_window = "mon:05:00-mon:07:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 0
  snapshot_window = "03:00-05:00"

  # Tags
  tags = var.tags
}

# -----------------------------------------------------------------------------
# Rate Limiting Resources
# -----------------------------------------------------------------------------

# DynamoDB table for rate limiting state (if not using Upstash)
resource "aws_dynamodb_table" "rate_limits" {
  count = !var.enable_cluster_mode ? 1 : 0

  name           = "lole-rate-limits-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "key"

  attribute {
    name = "key"
    type = "S"
  }

  # TTL for automatic cleanup
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Local Values for Outputs
# -----------------------------------------------------------------------------

locals {
  # Use Upstash configuration if provided
  use_upstash = var.upstash_redis_rest_api_url != "" && var.upstash_redis_rest_api_token != ""

  # Redis connection info
  redis_host = var.enable_cluster_mode 
    ? aws_elasticache_replication_group.lole[0].primary_endpoint_address
    : (local.use_upstash 
        ? "redis.upstash.io"  # Simplified for Upstash
        : "")

  redis_port = var.enable_cluster_mode 
    ? 6379 
    : (local.use_upstash ? 6379 : 0)
}
