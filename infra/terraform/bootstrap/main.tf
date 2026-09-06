module "bootstrap" {
  source = "github.com/collinbentley1/platform//terraform/modules/bootstrap?ref=52cb2dea765ead93f204ee4a5bd884b9fbb0f13a"

  app                         = "cdbentley"
  project_id                  = var.project_id
  region                      = var.region
  state_bucket_name           = var.state_bucket_name
  bootstrap_state_bucket_name = var.bootstrap_state_bucket_name
  state_bucket_location       = var.state_bucket_location
  github_owner                = var.github_owner
  github_repo                 = var.github_repo
  github_repository_id        = var.github_repository_id
  active_workflow_sha         = "52cb2dea765ead93f204ee4a5bd884b9fbb0f13a"

  manage_automatic_default_service_account_grants_policy = var.manage_automatic_default_service_account_grants_policy
  runtime_description                                    = "Runtime identity for the cdbentley Cloud Run services."
}
