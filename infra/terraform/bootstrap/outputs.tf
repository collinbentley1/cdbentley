output "state_bucket_name" {
  description = "Terraform state bucket."
  value       = google_storage_bucket.terraform_state.name
}

output "workload_identity_provider" {
  description = "Full Workload Identity Provider resource name for GitHub Actions."
  value       = "projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.github.workload_identity_pool_provider_id}"
}

output "terraform_service_account_email" {
  description = "Service account used by Terraform apply workflow."
  value       = google_service_account.terraform.email
}

output "prod_deploy_service_account_email" {
  description = "Service account used by production deploy workflow."
  value       = google_service_account.prod_deploy.email
}

output "preview_deploy_service_account_email" {
  description = "Service account used by preview deploy and cleanup workflows."
  value       = google_service_account.preview_deploy.email
}

output "runtime_service_account_email" {
  description = "Cloud Run runtime service account."
  value       = google_service_account.runtime.email
}

