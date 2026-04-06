#!/bin/bash
#
# Deploy a seismic model JSON Schema to S3.
#
# Usage: ./scripts/seismic/deploy-model-schema.sh v1
#
# The schema file must exist at src/public/schemas/seismic-model/<version>.json.
# Refuses to overwrite an existing schema at the S3 location — schema versions
# are immutable once published.

set -euo pipefail

S3_BUCKET="models-resources"
S3_PREFIX="collaborative-learning/schemas/seismic-model"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <schema-version>"
  echo "Example: $0 v1"
  exit 1
fi

VERSION="$1"
LOCAL_FILE="src/public/schemas/seismic-model/${VERSION}.json"
S3_KEY="${S3_PREFIX}/${VERSION}.json"
S3_URL="s3://${S3_BUCKET}/${S3_KEY}"

if [ ! -f "$LOCAL_FILE" ]; then
  echo "Error: Local schema file not found: $LOCAL_FILE"
  echo "Run 'npm run update:seismic-schema' to generate it."
  exit 1
fi

# Verify the checked-in schema matches the TypeScript interface
echo "Verifying schema matches ModelMetadata interface..."
if ! npx jest shared/seismic/seismic-model-schema.test.ts --no-coverage 2>&1; then
  echo "Error: Schema does not match the TypeScript interface."
  echo "Run 'npm run update:seismic-schema' to regenerate it."
  exit 1
fi

# Check if the schema already exists in S3
if aws s3api head-object --bucket "$S3_BUCKET" --key "$S3_KEY" 2>/dev/null; then
  echo "Error: Schema already exists at $S3_URL"
  echo "Schema versions are immutable once published. Bump the version instead."
  exit 1
fi

aws s3 cp "$LOCAL_FILE" "$S3_URL" --content-type "application/json"
echo "Deployed schema to $S3_URL"
echo "Available at: https://collaborative-learning.concord.org/schemas/seismic-model/${VERSION}.json"
