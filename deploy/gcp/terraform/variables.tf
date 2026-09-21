variable "project_id" {
  description = "Google Cloud project that will own every resource here."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run and Cloud SQL. me-west1 is Tel Aviv, which is the closest to this app's users."
  type        = string
  default     = "me-west1"
}

variable "db_tier" {
  description = <<-EOT
    Cloud SQL machine type. db-f1-micro is the cheapest and is enough for a few
    buildings; it is a shared-core instance with no HA. Note that Cloud SQL does
    not scale to zero, so this is the floor of the monthly cost.
  EOT
  type        = string
  default     = "db-f1-micro"
}

variable "db_deletion_protection" {
  description = "Keep on outside throwaway environments; it prevents terraform destroy from dropping the database."
  type        = bool
  default     = true
}

variable "postgrest_image" {
  description = "PostgREST container image. Pinned rather than :latest so a deploy cannot change the API layer underneath you."
  type        = string
  default     = "postgrest/postgrest:v12.2.3"
}

variable "gotrue_image" {
  description = "Supabase Auth (GoTrue) container image, pinned for the same reason."
  type        = string
  default     = "supabase/gotrue:v2.158.1"
}

variable "site_url" {
  description = "Base URL auth redirects back to, and the origin used in emails."
  type        = string
  default     = "https://asscobara.github.io/ComotV2/app/"
}

variable "additional_redirect_urls" {
  description = "Exact URLs auth may redirect to. comot:// is the native app scheme."
  type        = list(string)
  default     = ["https://asscobara.github.io/ComotV2/app/", "comot://", "http://localhost:8081"]
}

variable "smtp" {
  description = <<-EOT
    Outbound mail for password resets and confirmations. Leave host empty to skip
    SMTP entirely, which also requires disabling email confirmation in GoTrue —
    fine for a first deploy, not for production password resets.
  EOT
  type = object({
    host        = optional(string, "")
    port        = optional(number, 587)
    user        = optional(string, "")
    pass        = optional(string, "")
    admin_email = optional(string, "")
    sender_name = optional(string, "ComOt")
  })
  default = {}
}

variable "disable_signup" {
  description = "Set true to stop new sign-ups without taking the app down."
  type        = bool
  default     = false
}
