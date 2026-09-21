output "api_url" {
  description = "PostgREST base URL. The app's data layer talks to this."
  value       = google_cloud_run_v2_service.postgrest.uri
}

output "auth_url" {
  description = "GoTrue base URL. The app's auth layer talks to this."
  value       = google_cloud_run_v2_service.gotrue.uri
}

output "sql_connection_name" {
  description = "Pass to cloud-sql-proxy to reach the database from your machine."
  value       = google_sql_database_instance.main.connection_name
}


# The app needs one origin for both /auth/v1 and /rest/v1, and Cloud Run gives each
# service its own hostname, so the client is configured with the two URLs
# separately rather than a single Supabase-style base URL. See
# docs/GCP_MIGRATION.md for the client change this implies.
output "app_env" {
  description = "Values for apps/mobile/.env once the migration is cut over."
  value       = <<-EOT
    EXPO_PUBLIC_SUPABASE_URL=${google_cloud_run_v2_service.postgrest.uri}
    EXPO_PUBLIC_AUTH_URL=${google_cloud_run_v2_service.gotrue.uri}
  EOT
}

output "read_secrets" {
  description = "Commands to read the generated passwords when you need to connect by hand. They are never printed by Terraform."
  value       = <<-EOT
    gcloud secrets versions access latest --secret=comot-db-app-password --project=${var.project_id}
    gcloud secrets versions access latest --secret=comot-db-authenticator-password --project=${var.project_id}
    gcloud secrets versions access latest --secret=comot-db-auth-admin-password --project=${var.project_id}
    gcloud secrets versions access latest --secret=comot-jwt-secret --project=${var.project_id}
  EOT
}

output "psql_via_proxy" {
  description = "How to run the migrations and the SQL in deploy/gcp/sql from your machine."
  value       = <<-EOT
    # terminal 1
    cloud-sql-proxy --port 5433 ${google_sql_database_instance.main.connection_name}

    # terminal 2
    export PGPASSWORD="$(gcloud secrets versions access latest --secret=comot-db-app-password --project=${var.project_id})"
    psql -h 127.0.0.1 -p 5433 -U comot_app -d comot
  EOT
}
