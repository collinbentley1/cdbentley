terraform {
  required_version = "~> 1.14.0"

  backend "gcs" {
    bucket = "cdbentley-tfstate-882468538648"
    prefix = "cdbentley/bootstrap"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 7.34.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
