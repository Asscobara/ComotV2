locals {
  sql_connection = google_sql_database_instance.main.connection_name

  # Both services connect over the Cloud SQL unix socket that Cloud Run mounts,
  # so no password travels over a network and there is no IP to allow-list.
  socket_dir = "/cloudsql/${google_sql_database_instance.main.connection_name}"
}

# ---------------------------------------------------------------------------
# PostgREST — the REST and RPC surface
#
# This is what keeps the migration small: it serves the same endpoints Supabase
# did, so all 30 .from()/.rpc() call sites in the app and the postgrest-js client
# keep working untouched. It enforces nothing itself; it passes the verified JWT
# claims to Postgres and RLS decides.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "postgrest" {
  name     = "comot-api"
  location = var.region

  # Public: the app is a mobile/web client, and authorisation is the JWT plus RLS.
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email

    scaling {
      # Scales to zero, so this costs nothing while idle. First request after
      # idling pays a cold start.
      min_instance_count = 0
      max_instance_count = 4
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.sql_connection]
      }
    }

    containers {
      image = var.postgrest_image

      ports {
        container_port = 3000
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "PGRST_DB_URI"
        value = "postgres://authenticator@/comot?host=${local.socket_dir}&password=${random_password.db_authenticator.result}"
      }
      env {
        name  = "PGRST_DB_SCHEMAS"
        value = "public"
      }
      env {
        name  = "PGRST_DB_ANON_ROLE"
        value = "anon"
      }
      env {
        name = "PGRST_JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["jwt-secret"].secret_id
            version = "latest"
          }
        }
      }
      # Without this PostgREST would accept tokens addressed to anything.
      env {
        name  = "PGRST_JWT_AUD"
        value = "authenticated"
      }
      env {
        name  = "PGRST_DB_MAX_ROWS"
        value = "1000"
      }
      # Keep the pool well under Cloud SQL's connection limit, since several
      # instances can be up at once.
      env {
        name  = "PGRST_DB_POOL"
        value = "6"
      }
      env {
        name  = "PGRST_LOG_LEVEL"
        value = "error"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        tcp_socket {
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }

  depends_on = [
    google_sql_user.authenticator,
    google_secret_manager_secret_version.v,
    google_secret_manager_secret_iam_member.run_secret_access,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "postgrest_public" {
  name     = google_cloud_run_v2_service.postgrest.name
  location = google_cloud_run_v2_service.postgrest.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# GoTrue — authentication
#
# The same service Supabase runs, self-hosted here. Chosen over Identity Platform
# because it keeps auth.users with uuid primary keys, which is what profiles.id
# references and what the on_auth_user_created trigger populates. Identity
# Platform would mean mapping string Firebase UIDs onto uuids, a provisioning
# function, and rewriting the app's 19 auth call sites; this way none of that
# changes.
#
# The cost is that you are running an auth container: watch its releases and
# redeploy for security fixes.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "gotrue" {
  name     = "comot-auth"
  location = var.region

  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email

    scaling {
      # Kept warm: a cold start on the sign-in path is the first thing a user
      # would feel, and this is the cheapest instance size anyway.
      min_instance_count = 1
      max_instance_count = 3
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.sql_connection]
      }
    }

    containers {
      image = var.gotrue_image

      ports {
        container_port = 9999
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      env {
        name  = "GOTRUE_API_HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "PORT"
        value = "9999"
      }
      env {
        name  = "GOTRUE_DB_DRIVER"
        value = "postgres"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgres://supabase_auth_admin@/comot?host=${local.socket_dir}&password=${random_password.db_auth_admin.result}&search_path=auth"
      }
      env {
        name = "GOTRUE_JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["jwt-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "GOTRUE_JWT_AUD"
        value = "authenticated"
      }
      env {
        name  = "GOTRUE_JWT_DEFAULT_GROUP_NAME"
        value = "authenticated"
      }
      env {
        name  = "GOTRUE_JWT_EXP"
        value = "3600"
      }
      env {
        name  = "GOTRUE_SITE_URL"
        value = var.site_url
      }
      env {
        name  = "GOTRUE_URI_ALLOW_LIST"
        value = join(",", var.additional_redirect_urls)
      }
      env {
        name  = "GOTRUE_DISABLE_SIGNUP"
        value = tostring(var.disable_signup)
      }
      env {
        name  = "GOTRUE_EXTERNAL_EMAIL_ENABLED"
        value = "true"
      }
      # Without SMTP configured, requiring confirmation would lock every new
      # account out, so the two settings are tied together deliberately.
      env {
        name  = "GOTRUE_MAILER_AUTOCONFIRM"
        value = var.smtp.host == "" ? "true" : "false"
      }
      env {
        name  = "GOTRUE_SMTP_HOST"
        value = var.smtp.host
      }
      env {
        name  = "GOTRUE_SMTP_PORT"
        value = tostring(var.smtp.port)
      }
      env {
        name  = "GOTRUE_SMTP_USER"
        value = var.smtp.user
      }
      env {
        name  = "GOTRUE_SMTP_PASS"
        value = var.smtp.pass
      }
      env {
        name  = "GOTRUE_SMTP_ADMIN_EMAIL"
        value = var.smtp.admin_email
      }
      env {
        name  = "GOTRUE_SMTP_SENDER_NAME"
        value = var.smtp.sender_name
      }
      env {
        name  = "GOTRUE_LOG_LEVEL"
        value = "info"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 9999
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 12
      }
    }
  }

  depends_on = [
    google_sql_user.auth_admin,
    google_secret_manager_secret_version.v,
    google_secret_manager_secret_iam_member.run_secret_access,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "gotrue_public" {
  name     = google_cloud_run_v2_service.gotrue.name
  location = google_cloud_run_v2_service.gotrue.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
