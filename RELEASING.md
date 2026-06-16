<!--
SPDX-License-Identifier: Apache-2.0
SPDX-FileCopyrightText: 2026 Tommy Lehmann
-->

# Releasing securityportal-web

This document explains how versions work, how to cut and publish a release, how
to consume and verify the published artifacts, and how to re-enable everything
in a fork. The companion guide for the backend lives in
`securityportal-api/RELEASING.md`.

## What gets published

A release is driven by **pushing a Git tag**. The
[`release.yml`](.github/workflows/release.yml) workflow then produces:

| Artifact                     | Where                                | Notes                                                                                                                                                 |
| ---------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container image              | `ghcr.io/<owner>/securityportal-web` | Primary (and only) deploy artifact. Tags: `vX.Y.Z`, `X.Y`, `X`, `latest`, `sha-<commit>`. Consumed by `docker/docker-compose.yml` and the Helm chart. |
| Build-provenance attestation | attached to the image in GHCR        | SLSA provenance, keyless (OIDC). Proves which workflow/commit built the image.                                                                        |
| SBOM attestation             | attached to the image in GHCR        | SPDX SBOM bound to the image digest.                                                                                                                  |
| GitHub Release               | the repo's Releases page             | `securityportal-web-sbom.spdx.json` and `securityportal-web-sbom.cdx.json`.                                                                           |

> The image targets `linux/amd64` (the compose/Helm deployment target). To also
> publish `linux/arm64`, see the commented `platforms:` note in `release.yml`.

## Versioning — Semantic Versioning, derived from Git

We follow [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **The Git tag is the source of truth.** Tag `v1.4.2` ⇒ the image is version
  `v1.4.2`. The version is baked into the bundle at build time via
  `PUBLIC_APP_VERSION` → the `__APP_VERSION__` Vite constant
  ([`vite.config.ts`](vite.config.ts)) and is **shown in the page footer**.
- **Untagged / local builds** fall back to `git describe --tags --always
--dirty`, then to the `package.json` version — so the footer is never blank.
- Bump **MAJOR** for breaking UI/contract changes, **MINOR** for backward-
  compatible features, **PATCH** for fixes.

## Cutting a release

1. Make sure `main`/`master` is green (the [`ci.yml`](.github/workflows/ci.yml)
   build/test/e2e gate and [`security.yml`](.github/workflows/security.yml) pass).
2. Update [`CHANGELOG.md`](CHANGELOG.md): move items from _Unreleased_ into a new
   `## [X.Y.Z] - YYYY-MM-DD` section.
3. Commit and push that to the default branch.
4. Tag and push:

   ```sh
   git tag -a vX.Y.Z -m "securityportal-web vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. Watch the **Release** workflow in the Actions tab. When it's green you have a
   GHCR image and a GitHub Release with SBOMs + attestations.

### Dry run (no release)

Trigger **Release** manually (Actions → Release → _Run workflow_). It builds and
pushes an image tagged from `git describe` and records attestations, but does
**not** create a GitHub Release.

### Build locally (parity check)

```sh
# The footer version comes from PUBLIC_APP_VERSION, else git describe:
PUBLIC_APP_VERSION="$(git describe --tags --always --dirty)" npm run build
npm run sbom            # CycloneDX SBOM (production deps)

# Or the full image, version baked in + labelled:
docker build -t securityportal-web:dev \
  --build-arg BUILD_VERSION="$(git describe --tags --always --dirty)" .
```

## Consuming & verifying a release

```sh
# Pull (pin to a digest in production):
docker pull ghcr.io/<owner>/securityportal-web:vX.Y.Z

# Verify build provenance and SBOM (needs gh >= 2.49):
gh attestation verify oci://ghcr.io/<owner>/securityportal-web:vX.Y.Z \
  --owner <owner>
```

SBOMs are also attached to each GitHub Release and uploaded as a CI artifact by
`security.yml`.

## Supply-chain hygiene

- **Pinning.** Every third-party GitHub Action is pinned to a full commit SHA
  (the trailing `# vX.Y.Z` comment is human-readable only); the Docker base
  image is pinned by digest. A `.dockerignore` keeps `.git`, `.env` and host
  `node_modules` out of the image.
- **Staying current.** [`dependabot.yml`](.github/dependabot.yml) opens weekly
  PRs for npm packages, Actions, and the base-image digest. Turn on **Dependabot
  security updates** (repo _Settings → Code security_) for fast-tracked PRs on
  vulnerable deps. CI re-validates every PR.
- **Monitoring.** [`supply-chain-monitor.yml`](.github/workflows/supply-chain-monitor.yml)
  runs weekly: Trivy scans the source tree and the latest published image,
  uploads results to **Security → Code scanning**, and opens/updates a single
  `supply-chain`-labelled issue on new HIGH/CRITICAL findings (auto-closed when
  clean). Run it on demand via _Run workflow_.
- **Re-pinning the base image by hand** (if you can't wait for Dependabot):

  ```sh
  docker buildx imagetools inspect library/node:20-alpine \
    --format '{{.Manifest.Digest}}'
  ```

  then update the `@sha256:…` (both stages) in [`Dockerfile`](Dockerfile).

## Setting this up in a fork

The pipeline needs **no secrets** beyond the automatic `GITHUB_TOKEN`, and never
hardcodes an owner — images publish to `ghcr.io/<your-namespace>/…`
automatically. After forking:

1. **Actions** → enable workflows in the fork.
2. **Settings → Actions → General → Workflow permissions** → **Read and write
   permissions** (lets the release job push to GHCR and the monitor job file
   issues).
3. **Settings → Code security** → enable **Dependabot alerts**, **Dependabot
   security updates**, and **Code scanning** (free on public repos; the
   monitor's SARIF upload needs Code scanning).
4. (First release only) push a tag to create the GHCR package, then set its
   visibility to public under your profile's _Packages_ if you want anonymous
   pulls.

No personal access tokens, signing keys, or registry credentials are required:
GHCR auth uses `GITHUB_TOKEN`, and attestations use keyless OIDC signing.
