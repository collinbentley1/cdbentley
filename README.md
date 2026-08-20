# cdbentley

Personal site infrastructure and deployment automation for `cdbentley`.

This repository is MIT-licensed, but it is not accepting external contributions.

## What is here

- Terraform bootstrap for Google Cloud APIs, state storage, Workload Identity Federation, and CI service accounts.
- Terraform production infrastructure for Artifact Registry and Cloud Run.
- GitHub Actions for Terraform validation/apply, Checkov IaC scanning, Socket Firewall dependency install checks, PR previews, preview cleanup, and production deployment.
- GitHub Actions are pinned to full commit SHAs and the repository is configured to require SHA-pinned actions.

## Deployment model

- Pull request updates deploy ephemeral Cloud Run preview services named `cdbentley-pr-<number>`.
- Closing a pull request deletes its preview Cloud Run service.
- Merges to `main` deploy the production Cloud Run service named `cdbentley`.
- Terraform does not manage preview environments. It manages only long-lived shared infrastructure.

## Bootstrap

The bootstrap root is applied manually because it creates the GitHub Actions identities that later run production Terraform.

```sh
gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project=cdbentley

export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap apply
terraform -chdir=infra/terraform/prod init
terraform -chdir=infra/terraform/prod apply
```

Both Terraform roots use a GCS backend:

```text
bucket: cdbentley-tfstate-882468538648
prefix: cdbentley/bootstrap
prefix: cdbentley/prod
```

## Application

The site is a pure Bun frontend/backend. Local verification uses stable Bun 1.4:

```sh
bun upgrade --stable
bun run hooks:install
bun run verify
```

Socket's native Bun scanner is configured in `bunfig.toml`, and CI runs Bun 1.4.0 for install, formatting, linting, tests, and build. The production container uses Docker Hardened Images for Bun and pins the Docker build to exactly `bun-v1.4.0`.
