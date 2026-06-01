output "state_bucket_name" {
  description = "Terraform state bucket."
  value       = module.bootstrap.state_bucket_name
}

output "workload_identity_provider" {
  description = "Full Workload Identity Provider resource name for GitHub Actions."
  value       = module.bootstrap.workload_identity_provider
}

output "terraform_service_account_email" {
  description = "Service account used by Terraform apply workflow."
  value       = module.bootstrap.terraform_service_account_email
}

output "prod_deploy_service_account_email" {
  description = "Service account used by production deploy workflow."
  value       = module.bootstrap.prod_deploy_service_account_email
}

output "preview_deploy_service_account_email" {
  description = "Service account used by preview deploy and cleanup workflows."
  value       = module.bootstrap.preview_deploy_service_account_email
}

output "runtime_service_account_email" {
  description = "Cloud Run runtime service account."
  value       = module.bootstrap.runtime_service_account_email
}
