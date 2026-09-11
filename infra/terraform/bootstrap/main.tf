module "bootstrap" {
  source = "github.com/collinbentley1/platform//terraform/modules/bootstrap?ref=f857a58e3ecac63b2b3882809efbfb7136bfa6c3"

  app                         = "cdbentley"
  project_id                  = var.project_id
  region                      = var.region
  state_bucket_name           = var.state_bucket_name
  bootstrap_state_bucket_name = var.bootstrap_state_bucket_name
  state_bucket_location       = var.state_bucket_location
  github_owner                = var.github_owner
  github_repo                 = var.github_repo
  github_repository_id        = var.github_repository_id
  active_workflow_sha         = "f857a58e3ecac63b2b3882809efbfb7136bfa6c3"

  manage_automatic_default_service_account_grants_policy = var.manage_automatic_default_service_account_grants_policy
  runtime_description                                    = "Runtime identity for the cdbentley Cloud Run services."
}
