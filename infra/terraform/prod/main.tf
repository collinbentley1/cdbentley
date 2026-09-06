module "site" {
  source = "github.com/collinbentley1/platform//terraform/modules/cloud-run-service?ref=6b745b98da093b83683109cdc9f0bb6f5ad24eaf"

  providers = {
    google                = google
    google.no_attribution = google.no_attribution
  }

  app                                            = "cdbentley"
  project_id                                     = var.project_id
  region                                         = var.region
  service_name                                   = var.service_name
  artifact_registry_repository_id                = var.artifact_registry_repository_id
  artifact_registry_description                  = "Container images for the cdbentley personal site."
  bootstrap_image                                = var.bootstrap_image
  bootstrap_runtime_service_account_email        = var.bootstrap_runtime_service_account_email
  runtime_service_account_email                  = var.runtime_service_account_email
  preview_runtime_service_account_email          = var.preview_runtime_service_account_email
  preview_ingress                                = var.preview_ingress
  prod_deploy_service_account_email              = var.prod_deploy_service_account_email
  prod_publisher_service_account_email           = var.prod_publisher_service_account_email
  deployment_parity_reader_service_account_email = var.deployment_parity_reader_service_account_email
  preview_deploy_service_account_email           = var.preview_deploy_service_account_email
  preview_commit_service_account_email           = var.preview_commit_service_account_email
  preview_operator_service_account_email         = var.preview_operator_service_account_email
  preview_publisher_service_account_email        = var.preview_publisher_service_account_email
  runtime_secret_ids                             = var.runtime_secret_ids
  runtime_secret_accessor_ids                    = var.runtime_secret_accessor_ids
  runtime_secret_version_adder_ids               = var.runtime_secret_version_adder_ids
}
