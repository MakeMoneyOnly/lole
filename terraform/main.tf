# =============================================================================
# lole Restaurant OS - Terraform Main Configuration
# "Toast for Addis Ababa" - Infrastructure as Code
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.0"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 0.1"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Use remote state in production, local for development
  # Uncomment and configure for production:
  # backend "s3" {
  #   bucket         = "lole-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "lole-terraform-locks"
  # }
}

# =============================================================================
# Provider Configuration
# =============================================================================

provider "supabase" {
  # Configuration options - will be overridden by variables
}

provider "vercel" {
  # Configuration options - will be overridden by variables
}

provider "upstash" {
  # Configuration options - will be overridden by variables
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "lole"
      Description = "Restaurant Operating System for Ethiopia"
      ManagedBy   = "Terraform"
    }
  }
}

# =============================================================================
# Environment-Specific Configuration
# =============================================================================

locals {
  # Common tags based on environment
  common_tags = {
    Environment = var.environment
    CostCenter  = "Engineering"
  }

  # Environment-specific Supabase project reference
  supabase_project_id = var.environment == "production" 
    ? var.supabase_project_id_prod 
    : var.supabase_project_id_dev
}

# =============================================================================
# Module Composition
# =============================================================================

module "supabase" {
  source = "./modules/supabase"

  environment           = var.environment
  supabase_project_ref  = local.supabase_project_id

  # Database configuration
  database_password     = var.supabase_db_password
  database_version      = var.supabase_postgres_version

  # Auth configuration
  auth_site_url         = var.vercel_project_url
  auth_redirect_urls    = var.auth_redirect_urls

  # Storage configuration
  storage_max_file_size_mb = var.storage_max_file_size_mb

  # Enable features based on environment
  enable_auth       = true
  enable_storage     = true
  enable_realtime    = true
  enable_edge_functions = var.environment != "development"

  # Additional settings
  plan_type          = var.environment == "production" ? "pro" : "free"

  tags = local.common_tags
}

module "redis" {
  source = "./modules/redis"

  environment = var.environment
  aws_region  = var.aws_region

  # Upstash configuration
  upstash_email    = var.upstash_email
  upstash_team_id  = var.upstash_team_id

  # Redis configuration
  redis_maxmemory_policy = "allkeys-lru"
  enable_cluster_mode    = var.environment == "production"

  tags = local.common_tags
}

module "vercel" {
  source = "./modules/vercel"

  environment = var.environment
  vercel_team_id = var.vercel_team_id

  # Project configuration
  project_name = var.vercel_project_name

  # Git configuration
  git_repo_url   = var.git_repo_url
  git_repo_type  = "github"

  # Build settings
  framework      = "nextjs"
  node_version   = "20"

  # Environment variables (sensitive values passed as sensitive)
  env_vars = {
    NEXT_PUBLIC_SUPABASE_URL       = var.supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY  = var.supabase_anon_key
    # Note: SUPABASE_SERVICE_ROLE_KEY should be set in Vercel project settings
    # and passed as a sensitive environment variable
  }

  # Production domains
  production_domains = var.production_domains

  tags = local.common_tags
}

# =============================================================================
# Optional: Self-hosted Kubernetes Manifests
# =============================================================================

# Uncomment if using self-hosted option:
# module "kubernetes" {
#   source = "./modules/kubernetes"
#
#   environment     = var.environment
#   cluster_name    = var.kubernetes_cluster_name
#   namespace       = "lole"
#
#   # Database connection
#   database_host   = var.database_host
#   database_port   = var.database_port
#   database_name   = var.database_name
#
#   # Redis configuration
#   redis_host      = module.redis.redis_host
#   redis_port      = module.redis.redis_port
#
#   tags = local.common_tags
# }
