#!/usr/bin/env bash
set -euo pipefail

echo "Building production bundle..."
npm run build
echo "Build complete. To preview: npm run preview"

