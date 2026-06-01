data "google_project" "current" {
  project_id = var.project_id
}

locals {
  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])

  github_repo_full_name  = "${var.github_owner}/${var.github_repo}"
  github_main_subject    = "repo:${local.github_repo_full_name}:ref:refs/heads/main"
  workload_identity_pool = "projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}"

  github_main_principal     = "principal://iam.googleapis.com/${local.workload_identity_pool}/subject/${local.github_main_subject}"
  github_repo_principal_set = "principalSet://iam.googleapis.com/${local.workload_identity_pool}/attribute.repository_id/${var.github_repository_id}"
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "terraform_state" {
  name                        = var.state_bucket_name
  project                     = var.project_id
  location                    = var.state_bucket_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age                   = 90
      num_newer_versions    = 20
      with_state            = "ARCHIVED"
      matches_storage_class = ["STANDARD"]
    }
  }

  labels = {
    app        = "cdbentley"
    managed-by = "terraform"
  }

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "GitHub Actions OIDC identities for ${local.github_repo_full_name}."

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"
  description                        = "OIDC provider restricted to ${local.github_repo_full_name}."

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
  }

  attribute_condition = "assertion.repository_owner_id == '${var.github_owner_id}' && assertion.repository_id == '${var.github_repository_id}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com/"
  }
}

resource "google_service_account" "terraform" {
  project      = var.project_id
  account_id   = "gha-terraform"
  display_name = "GitHub Actions Terraform"
  description  = "Runs production Terraform from GitHub Actions on main."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "prod_deploy" {
  project      = var.project_id
  account_id   = "gha-prod-deploy"
  display_name = "GitHub Actions Production Deploy"
  description  = "Builds and deploys the production Cloud Run service from main."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "preview_deploy" {
  project      = var.project_id
  account_id   = "gha-preview-deploy"
  display_name = "GitHub Actions Preview Deploy"
  description  = "Builds, deploys, and deletes pull request Cloud Run previews."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "cloud-run-runtime"
  display_name = "Cloud Run Runtime"
  description  = "Runtime identity for the cdbentley Cloud Run services."

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "terraform_project_roles" {
  for_each = toset([
    "roles/artifactregistry.admin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/viewer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_project_iam_member" "deploy_project_roles" {
  for_each = {
    prod_run_admin    = { role = "roles/run.admin", email = google_service_account.prod_deploy.email }
    prod_viewer       = { role = "roles/viewer", email = google_service_account.prod_deploy.email }
    preview_run_admin = { role = "roles/run.admin", email = google_service_account.preview_deploy.email }
    preview_viewer    = { role = "roles/viewer", email = google_service_account.preview_deploy.email }
  }

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${each.value.email}"
}

resource "google_storage_bucket_iam_member" "terraform_state_admin" {
  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_service_account_iam_member" "terraform_uses_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.terraform.email}"
}

resource "google_service_account_iam_member" "prod_deploy_uses_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.prod_deploy.email}"
}

resource "google_service_account_iam_member" "preview_deploy_uses_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.preview_deploy.email}"
}

resource "google_service_account_iam_member" "terraform_wif_main" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_main_principal
}

resource "google_service_account_iam_member" "terraform_wif_main_token_creator" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.github_main_principal
}

resource "google_service_account_iam_member" "prod_deploy_wif_main" {
  service_account_id = google_service_account.prod_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_main_principal
}

resource "google_service_account_iam_member" "prod_deploy_wif_main_token_creator" {
  service_account_id = google_service_account.prod_deploy.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.github_main_principal
}

resource "google_service_account_iam_member" "preview_deploy_wif_repo" {
  service_account_id = google_service_account.preview_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_repo_principal_set
}

resource "google_service_account_iam_member" "preview_deploy_wif_repo_token_creator" {
  service_account_id = google_service_account.preview_deploy.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.github_repo_principal_set
}
