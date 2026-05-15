# =============================================================================
# Redis Module Outputs
# =============================================================================

output "redis_host" {
  description = "Redis host"
  value       = local.redis_host
}

output "redis_port" {
  description = "Redis port"
  value       = local.redis_port
}

output "redis_rest_api_url" {
  description = "Upstash Redis REST API URL"
  value       = var.upstash_redis_rest_api_url
  sensitive   = true
}

output "redis_rest_api_token" {
  description = "Upstash Redis REST API token"
  value       = var.upstash_redis_rest_api_token
  sensitive   = true
}

output "redis_database_id" {
  description = "Upstash Redis database ID"
  value       = ""  # To be filled from Upstash console
}

output "dynamodb_rate_limits_table" {
  description = "DynamoDB table for rate limiting"
  value       = try(aws_dynamodb_table.rate_limits[0].name, "")
}

output "redis_cluster_endpoint" {
  description = "Redis cluster primary endpoint (production)"
  value       = try(aws_elasticache_replication_group.lole[0].primary_endpoint_address, "")
}

output "redis_cluster_reader_endpoint" {
  description = "Redis cluster reader endpoint (production)"
  value       = try(aws_elasticache_replication_group.lole[0].reader_endpoint_address, "")
}
