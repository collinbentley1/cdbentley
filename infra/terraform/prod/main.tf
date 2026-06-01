locals {
  labels = {
    app        = "cdbentley"
    managed-by = "terraform"
  }

  custom_domains = toset([
    "cdbentley.com",
    "www.cdbentley.com",
  ])
}

resource "google_artifact_registry_repository" "site" {
  #checkov:skip=CKV_GCP_84:Google-managed encryption is sufficient for public personal-site container images.
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  description   = "Container images for the cdbentley personal site."
  format        = "DOCKER"

  docker_config {
    immutable_tags = true
  }

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "delete-pr-images-after-30-days"
    action = "DELETE"

    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["pr-"]
      older_than   = "2592000s"
    }
  }

  cleanup_policies {
    id     = "keep-recent-images"
    action = "KEEP"

    most_recent_versions {
      keep_count = 30
    }
  }

  labels = local.labels
}

resource "google_artifact_registry_repository_iam_member" "prod_deploy_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.site.location
  repository = google_artifact_registry_repository.site.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${var.prod_deploy_service_account_email}"
}

resource "google_artifact_registry_repository_iam_member" "preview_deploy_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.site.location
  repository = google_artifact_registry_repository.site.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${var.preview_deploy_service_account_email}"
}

resource "google_artifact_registry_repository_iam_member" "runtime_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.site.location
  repository = google_artifact_registry_repository.site.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${var.runtime_service_account_email}"
}

resource "google_cloud_run_v2_service" "site" {
  project              = var.project_id
  name                 = var.service_name
  location             = var.region
  client               = "terraform"
  deletion_protection  = true
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = true
  labels               = local.labels

  template {
    service_account                  = var.runtime_service_account_email
    timeout                          = "300s"
    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      name  = "site"
      image = var.bootstrap_image

      ports {
        name           = "http1"
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }

        cpu_idle          = true
        startup_cpu_boost = true
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_artifact_registry_repository.site,
    google_artifact_registry_repository_iam_member.runtime_reader,
  ]
}

resource "google_cloud_run_domain_mapping" "site" {
  for_each = local.custom_domains
  provider = google.no_attribution

  project  = var.project_id
  location = var.region
  name     = each.value

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.site.name
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      metadata[0].annotations,
      metadata[0].labels,
      spec[0].certificate_mode,
      spec[0].force_override,
    ]
  }
}
