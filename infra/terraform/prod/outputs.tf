output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository."
  value       = "${google_artifact_registry_repository.site.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.site.repository_id}"
}

output "cloud_run_service_name" {
  description = "Production Cloud Run service name."
  value       = google_cloud_run_v2_service.site.name
}

output "cloud_run_service_uri" {
  description = "Production Cloud Run service URL."
  value       = google_cloud_run_v2_service.site.uri
}

