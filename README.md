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

Bootstrap, production, and public-exposure changes must run through the owner-controlled, review-gated pipeline against `platform/terraform/deployments`; there is no supported manual apply path in this repository. Actions may be enabled only after that protected pipeline, its state migration, exact-SHA WIF, and SHA-only enforcement are verified. See the [pinned security rollout](https://github.com/collinbentley1/platform/blob/625efd11af9fd3b7f4d0ca972475173d5b25a472/docs/security-rollout.md).

Do not define `GCP_*` repository variables or repository-level deploy secrets.
The sole credential-bearing build environment is
`dhi-base-prefetch-20260822-098dca9280b3`, shared by preview and production.
It contains exactly the public-read-only
`DHI_PUBLIC_READ_TOKEN_20260822_098DCA9280B3` secret and the non-confidential
`DHI_USERNAME` variable. No Socket token or mutable Grype database manifest is
stored in GitHub; Socket uses public policy and Grype data is byte-pinned in the
reviewed platform commit. After inventory proof and old provider-token
revocation, the retired `preview-build`, `production-build`, and
`dependency-scan` environments must be empty and deleted. Publish,
cloud-deploy, preview-operations, and supply-chain environments remain
secretless for this app. Runtime configuration is selected in reviewed platform
code, not by repository variables.

## Application

The site is a pure Bun frontend/backend. Local development must use Bun `1.4.0`
at the exact reviewed revision
`34cbb9a40b4bd1bd767d134a7065e66c2432a676`, matching CI and the production
container. Before installing dependencies or running a repository script, fail
closed on the full embedded revision:

```sh
bun -e 'if (Bun.version !== "1.4.0" || Bun.revision !== "34cbb9a40b4bd1bd767d134a7065e66c2432a676") throw new Error("Bun must be 1.4.0+34cbb9a40")'
bun run hooks:install
bun run verify
```

Never install or upgrade Bun from a moving `stable`, `latest`, or `canary`
channel for this repository. `bun --revision` is a convenient display check,
but it abbreviates the commit; the assertion above is the canonical local
check.

The byte-canonical local Socket adapter is configured in `bunfig.toml`, and CI
runs the reviewed Bun revision for install, formatting, linting, tests, and
build. The production container uses Docker Hardened Images for Bun and pins
the Docker build to exactly `bun-v1.4.0`.
