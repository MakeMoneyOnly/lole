# =============================================================================
# Supabase Module
# =============================================================================

terraform {
  required_version = ">= 1.6.0"
}

# -----------------------------------------------------------------------------
# Database Configuration
# -----------------------------------------------------------------------------

# Note: Database schema is managed via Supabase migrations
# See: supabase/migrations/*.sql

# Resource: Database SQL execution (for initial setup)
# Note: Supabase Terraform provider has limited SQL execution capabilities
# Primary database management is done through the Supabase dashboard or CLI

# resource "supabase_sql" "initial_schema" {
#   count = var.environment == "development" ? 1 : 0
#   sql    = file("${path.module}/../../supabase/migrations/20240101_initial_schema.sql")
# }

# -----------------------------------------------------------------------------
# Auth Configuration
# -----------------------------------------------------------------------------

resource "supabase_auth_config" "default" {
  site_url           = var.auth_site_url
  redirect_urls      = var.auth_redirect_urls
  enable_signup      = true
  enable_anonymous_sign_ins = false

  # Email authentication settings
  email_enable_confirmations  = true
  email_enable_confirm_change = true

  # SMS authentication (for Ethiopia)
  sms_enable       = false
  sms_provider     = "twilio"

  # OAuth providers (optional)
  # Enable based on requirements
  # external_google_enabled   = true
  # external_github_enabled   = true

  # JWT configuration
  jwt_default_group = "authenticated"

  # Security settings
  allow_public_signups = false
}

# -----------------------------------------------------------------------------
# Storage Configuration
# -----------------------------------------------------------------------------

resource "supabase_storage_bucket" "avatars" {
  bucket_name = "avatars"
  public     = true
  file_size_limit = var.storage_max_file_size_mb
  allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]

  # Storage object management is done via Supabase dashboard
}

resource "supabase_storage_bucket" "receipts" {
  bucket_name = "receipts"
  public     = false
  file_size_limit = var.storage_max_file_size_mb * 2  # 100MB for receipts
  allowed_mime_types = ["image/png", "image/jpeg", "application/pdf"]
}

resource "supabase_storage_bucket" "menu_images" {
  bucket_name = "menu-images"
  public     = true
  file_size_limit = var.storage_max_file_size_mb
  allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]
}

# -----------------------------------------------------------------------------
# Edge Functions (Optional)
# -----------------------------------------------------------------------------

# Note: Edge functions are deployed via Supabase CLI
# See: supabase/functions/*

# Example edge function configuration:
# resource "supabase_edge_function" "webhook_handler" {
#   name      = "webhook-handler"
#   schema    = "public"
#   import_db = false
#
#   verify_jwt = false  # For webhooks that don't require auth
# }

# -----------------------------------------------------------------------------
# Realtime Configuration
# -----------------------------------------------------------------------------

resource "supabase_realtime_config" "default" {
  enabled = var.enable_realtime

  # Realtime is enabled per-table via publication
  # This is configured in the database schema
}

# -----------------------------------------------------------------------------
# API Configuration
# -----------------------------------------------------------------------------

# Enable/disable GraphQL (currently disabled for security)
resource "supabase_graphql_config" "default" {
  enabled = false  # GraphQL is disabled per security requirements
}

# -----------------------------------------------------------------------------
# Database Extensions
# -----------------------------------------------------------------------------

# These extensions should be enabled in the database:
# - pg_repack (for table maintenance)
# - pg_cron (for scheduled jobs)
# - uuid-ossp (for UUID generation)

# Note: Extensions are managed via database migrations
