#!/bin/bash
# The Next.js homepage statically prerenders at build time and initializes the
# Firebase client SDK at module scope, so NEXT_PUBLIC_FIREBASE_* must be real
# values during `docker build`, not just at container runtime. EB's Docker
# platform builds the image from this same staging directory, and `next build`
# auto-loads `.env.production`, so write the environment properties configured
# on the EB environment (Configuration -> Software, or `eb setenv`) there
# before the image builds.
set -euo pipefail
env | grep -E '^(NEXT_PUBLIC_|FIREBASE_|VAPID_)' > .env.production || true
