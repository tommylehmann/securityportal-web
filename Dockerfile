# This file is Free Software under the Apache-2.0 License
# without warranty, see README.md and LICENSES/Apache-2.0.txt for details.
#
# SPDX-License-Identifier: Apache-2.0
#
# SPDX-FileCopyrightText: 2026 Tommy Lehmann

# Build the SvelteKit frontend.
FROM library/node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm clean-install

COPY . .
RUN npm run build


# Serve the built app with adapter-node's standalone Node server. `npm run
# build` emits a self-contained server under build/ whose entry point is
# build/index.js, started with `node build`.
FROM library/node:20-alpine AS runtime

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
