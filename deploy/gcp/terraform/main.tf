terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# APIs. Listed explicitly so a fresh project works from a single apply rather
# than failing one resource at a time.
# ---------------------------------------------------------------------------

resource "google_project_service" "required" {
  for_each = toset([
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
  ])
  service = each.value

  # Leave the APIs enabled on destroy; other things in the project may use them.
  disable_on_destroy = false
}

# ---------------------------------------------------------------------------
# Secrets
#
# Generated here rather than passed in, so they never sit in a tfvars file or a
# shell history. Read them out with the commands in outputs.tf when you need to
# connect by hand.
# ---------------------------------------------------------------------------

resource "random_password" "db_app" {
  length  = 32
  special = false # avoids percent-encoding problems in connection URIs
}

resource "random_password" "db_authenticator" {
  length  = 32
  special = false
}

resource "random_password" "db_auth_admin" {
  length  = 32
  special = false
}

# Shared between GoTrue (which signs tokens) and PostgREST (which verifies them).
# HS256 keeps the two services independent of a JWKS endpoint.
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

locals {
  secrets = {
    db-app-password           = random_password.db_app.result
    db-authenticator-password = random_password.db_authenticator.result
    db-auth-admin-password    = random_password.db_auth_admin.result
    jwt-secret                = random_password.jwt_secret.result
  }
}

resource "google_secret_manager_secret" "s" {
  for_each  = local.secrets
  secret_id = "comot-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "v" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.s[each.key].id
  secret_data = each.value
}

# ---------------------------------------------------------------------------
# Cloud SQL for PostgreSQL
#
# Holds ComOt's schema unchanged: the same 20 tables, 46 RLS policies and RPCs
# that supabase/migrations produces. Reached over the Cloud SQL connector rather
# than a public IP, so the database has no internet-facing surface.
# ---------------------------------------------------------------------------

resource "google_sql_database_instance" "main" {
  name             = "comot-pg"
  database_version = "POSTGRES_17"
  region           = var.region

  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 14
      }
    }

    ip_configuration {
      # An IP is assigned but nothing is allow-listed, so the instance accepts no
      # connections by address. Everything reaches it through the Cloud SQL
      # connector, which authenticates with IAM and encrypts in transit — that is
      # how Cloud Run's /cloudsql socket and cloud-sql-proxy both work.
      #
      # The alternative, a private-IP-only instance, needs Direct VPC egress or a
      # Serverless VPC Access connector wired up before Cloud Run can reach it. It
      # is a reasonable hardening step later; it is not the thing to get wrong on a
      # first apply, and it does not change who can actually connect.
      # No authorized_networks block at all, which is what makes the address
      # unusable: with an empty allow-list Cloud SQL refuses every direct
      # connection attempt.
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    database_flags {
      # Log statements that take longer than a second, to catch a missing index
      # before it becomes a support ticket.
      name  = "log_min_duration_statement"
      value = "1000"
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 3
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_sql_database" "comot" {
  name     = "comot"
  instance = google_sql_database_instance.main.name
}

# Owns the schema and runs the migrations.
resource "google_sql_user" "app" {
  name     = "comot_app"
  instance = google_sql_database_instance.main.name
  password = random_password.db_app.result
}

# PostgREST logs in as this and switches to anon/authenticated per request.
resource "google_sql_user" "authenticator" {
  name     = "authenticator"
  instance = google_sql_database_instance.main.name
  password = random_password.db_authenticator.result
}

# GoTrue owns the auth schema and creates auth.users itself.
resource "google_sql_user" "auth_admin" {
  name     = "supabase_auth_admin"
  instance = google_sql_database_instance.main.name
  password = random_password.db_auth_admin.result
}

# ---------------------------------------------------------------------------
# Service account for the Cloud Run services
#
# Its own identity with only the two roles it needs, rather than the default
# compute account which is broadly privileged.
# ---------------------------------------------------------------------------

resource "google_service_account" "run" {
  account_id   = "comot-run"
  display_name = "ComOt Cloud Run services"
  depends_on   = [google_project_service.required]
}

resource "google_project_iam_member" "run_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_secret_access" {
  for_each  = local.secrets
  secret_id = google_secret_manager_secret.s[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}
