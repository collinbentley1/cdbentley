# cdbentley

Personal site infrastructure and deployment automation for `cdbentley`.

This repository is MIT-licensed, but it is not accepting external contributions.

## What is here

- Consumer Terraform mirrors for local validation and review. They are not an apply surface.
- Minimal GitHub Actions callers pinned to one reviewed full platform commit SHA.
- Bun verification, Checkov IaC scanning, Socket dependency policy, final-image SBOM/Grype checks, pull request previews, preview reconciliation, and production deployment supplied by the shared platform.
- Every checked-in action is pinned to a full commit SHA, and repository-level
  SHA-only enforcement is mandatory whenever Actions are enabled.

## Deployment model

- Pull requests use tagged traffic on the single no-data Cloud Run service `cdbentley-preview`; they do not create a service per pull request.
- Closing, superseding, or reconciling a pull request removes only that pull request's tagged traffic after an exact-revision check.
- Merges to `main` deploy the production Cloud Run service named `cdbentley`.
- Build, Artifact Registry publication, Cloud Run deployment, preview operations, and supply-chain attestation use separate protected environments and least-scope identities.

## Infrastructure and secrets

The consumer roots under `infra/terraform` are validation/documentation mirrors. Routine repository CI validates them and performs read-only convergence checks. Any authenticated infrastructure operation checks out the exact reviewed platform commit and selects the platform-owned configuration by immutable numeric GitHub repository ID; it never executes this repository's HCL.

Bootstrap, production, and public-exposure changes must run through the owner-controlled, review-gated pipeline against `platform/terraform/deployments`; there is no supported manual apply path in this repository. Actions may be enabled only after that protected pipeline, its state migration, exact-SHA WIF, and SHA-only enforcement are verified. See the [pinned security rollout](https://github.com/collinbentley1/platform/blob/8cefb91ab8d20c0bbfef7feab2d2b15d76785632/docs/security-rollout.md).

Do not define `GCP_*` repository variables or repository-level deploy secrets.
Rotated `DHI_USERNAME`, `DHI_ACCESS_TOKEN`, `GRYPE_DB_MANIFEST_JSON`, and the
least-scope `SOCKET_API_TOKEN` belong only to the owner-approved `preview-build`
and `production-build` environments. The platform repository alone owns the
trusted-main `dependency-scan` token. Publish, cloud-deploy, preview-operations,
and supply-chain environments are otherwise secretless for this app. Runtime
configuration is selected in reviewed platform code, not by repository variables.

## Application

The site is a pure Bun frontend/backend. Local verification uses stable Bun 1.4:

```sh
bun upgrade --stable
bun run hooks:install
bun run verify
```

The byte-canonical local Socket adapter is configured in `bunfig.toml`, and CI runs Bun 1.4.0 for install, formatting, linting, tests, and build. The production container uses Docker Hardened Images for Bun and pins the Docker build to exactly `bun-v1.4.0`.
