module "site" {
  source = "github.com/collinbentley1/platform//terraform/modules/cloud-run-service?ref=v0.1.2"

  providers = {
    google                = google
    google.no_attribution = google.no_attribution
  }

  app                                  = "cdbentley"
  project_id                           = var.project_id
  region                               = var.region
  service_name                         = var.service_name
  artifact_registry_repository_id      = var.artifact_registry_repository_id
  artifact_registry_description        = "Container images for the cdbentley personal site."
  bootstrap_image                      = var.bootstrap_image
  runtime_service_account_email        = var.runtime_service_account_email
  prod_deploy_service_account_email    = var.prod_deploy_service_account_email
  preview_deploy_service_account_email = var.preview_deploy_service_account_email
  custom_domains = [
    "cdbentley.com",
    "www.cdbentley.com",
  ]
}

moved {
  from = google_artifact_registry_repository.site
  to   = module.site.google_artifact_registry_repository.site
}

moved {
  from = google_artifact_registry_repository_iam_member.prod_deploy_writer
  to   = module.site.google_artifact_registry_repository_iam_member.prod_deploy_writer
}

moved {
  from = google_artifact_registry_repository_iam_member.preview_deploy_writer
  to   = module.site.google_artifact_registry_repository_iam_member.preview_deploy_writer
}

moved {
  from = google_artifact_registry_repository_iam_member.runtime_reader
  to   = module.site.google_artifact_registry_repository_iam_member.runtime_reader
}

moved {
  from = google_cloud_run_v2_service.site
  to   = module.site.google_cloud_run_v2_service.site
}

moved {
  from = google_cloud_run_domain_mapping.site
  to   = module.site.google_cloud_run_domain_mapping.site
}
