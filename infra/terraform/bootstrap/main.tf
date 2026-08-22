module "bootstrap" {
  source = "github.com/collinbentley1/platform//terraform/modules/bootstrap?ref=d344f3835ca48f56c30a53641db8f3ea3a88ce53"

  app                         = "cdbentley"
  project_id                  = var.project_id
  region                      = var.region
  state_bucket_name           = var.state_bucket_name
  bootstrap_state_bucket_name = var.bootstrap_state_bucket_name
  state_bucket_location       = var.state_bucket_location
  github_owner                = var.github_owner
  github_repo                 = var.github_repo
  github_owner_id             = var.github_owner_id
  github_repository_id        = var.github_repository_id
  trusted_platform_workflow_shas = [
    "d344f3835ca48f56c30a53641db8f3ea3a88ce53",
  ]
  legacy_compatibility_mode                              = false
  manage_automatic_default_service_account_grants_policy = var.manage_automatic_default_service_account_grants_policy
  runtime_description                                    = "Runtime identity for the cdbentley Cloud Run services."
}
