# This file is Free Software under the Apache-2.0 License
# without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
#
# SPDX-License-Identifier: Apache-2.0
#
# SPDX-FileCopyrightText: 2026 Tommy Lehmann

# Build the SvelteKit frontend.
# Base image is pinned by digest (supply-chain hardening); the tag in the
# comment is human-readable. Dependabot (docker ecosystem, see
# .github/dependabot.yml) bumps the digest.
# library/node:20-alpine
FROM library/node:26-alpine@sha256:9c0e1e52125d6b67d505cf75b4880fcf1290ccea5c480849910e1d57b2cf72b5 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm clean-install

COPY . .

# Version is baked into the bundle at build time: PUBLIC_APP_VERSION ->
# __APP_VERSION__ (vite define) -> shown in the footer. The release workflow
# passes the git-derived SemVer; a plain local build falls back to git describe
# / package.json (see vite.config.ts).
ARG BUILD_VERSION=v0.0.0
ENV PUBLIC_APP_VERSION=$BUILD_VERSION
RUN npm run build


# Serve the built app with adapter-node's standalone Node server. `npm run
# build` emits a self-contained server under build/ whose entry point is
# build/index.js, started with `node build`.
FROM library/node:26-alpine@sha256:9c0e1e52125d6b67d505cf75b4880fcf1290ccea5c480849910e1d57b2cf72b5 AS runtime

# Re-declare to stamp a version label on the final image for plain local builds;
# CI's metadata-action also applies the full OCI label set on push.
ARG BUILD_VERSION=v0.0.0
LABEL org.opencontainers.image.title="securityportal-web" \
      org.opencontainers.image.version="${BUILD_VERSION}"

WORKDIR /app

ENV NODE_ENV=production
# adapter-node reads HOST/PORT at runtime; bind all interfaces on 8080 so the
# container is reachable and the port matches docker-compose.yml's web service.
ENV HOST=0.0.0.0
ENV PORT=8080

COPY --from=build /app/build ./build
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm clean-install --omit=dev

EXPOSE 8080

CMD ["node", "build"]
