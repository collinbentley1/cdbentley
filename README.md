# cdbentley

Personal site infrastructure and deployment automation for `cdbentley`.

This repository is public for visibility, but it is not an open source project and is not accepting external contributions.

## What is here

- Terraform bootstrap for Google Cloud APIs, state storage, Workload Identity Federation, and CI service accounts.
- Terraform production infrastructure for Artifact Registry and Cloud Run.
- GitHub Actions for Terraform validation/apply, Checkov IaC scanning, Socket Firewall dependency install checks, PR previews, preview cleanup, and production deployment.
- GitHub Actions are pinned to full commit SHAs and the repository is configured to require SHA-pinned actions.

## Deployment model

- Pull request updates deploy ephemeral Cloud Run preview services named `cdbentley-pr-<number>` once an application `Dockerfile` exists.
- Closing a pull request deletes its preview Cloud Run service.
- Merges to `main` deploy the production Cloud Run service named `cdbentley` once an application `Dockerfile` exists.
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

The Bun frontend/backend is intentionally not scaffolded yet. The deployment workflows skip cleanly until a root-level `Dockerfile` exists.

Socket Firewall Free supports npm, yarn, pnpm, pip, uv, and cargo. For a Bun-only dependency install, keep a supported npm/yarn/pnpm lockfile path available in CI if install-time Socket Firewall enforcement is required.
