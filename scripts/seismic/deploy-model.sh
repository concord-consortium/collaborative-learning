#!/bin/bash
#
# Deploy a seismic model (metadata.json + weights.json) to S3.
#
# The model's source of truth is the ML repo (Denolle-Lab/tiny-cnn-seismicML),
# not CLUE. This script fetches the model folder from GitHub at a given ref and
# uploads it to the CDN path that the Wave Runner tile fetches at runtime.
# CLUE only ever holds the model's URL, never the model files.
#
# Usage: ./scripts/seismic/deploy-model.sh <model-id> [git-ref] [schema-version]
#   <model-id>        Model folder under models/ in the ML repo, e.g. compact-v2
#   [git-ref]         Git ref to fetch from (default: main)
#   [schema-version]  CDN schema-version segment (default: v1)
#
# Example: ./scripts/seismic/deploy-model.sh compact-v2
#          ./scripts/seismic/deploy-model.sh compact-v2 main v1
#
# The fetched metadata.json is validated against the checked-in JSON Schema
# (src/public/schemas/seismic-model/<schema-version>.json) before anything is
# uploaded, so a malformed or drifted model can't reach the CDN.
#
# Refuses to overwrite an existing model at the S3 location — models are
# immutable once published. Bump the model id (compact-v2 -> compact-v3) instead.

set -euo pipefail

GITHUB_ORG="Denolle-Lab"
GITHUB_REPO="tiny-cnn-seismicML"
S3_BUCKET="models-resources"

if [ $# -lt 1 ] || [ $# -gt 3 ]; then
  echo "Usage: $0 <model-id> [git-ref] [schema-version]"
  echo "Example: $0 compact-v2"
  exit 1
fi

MODEL_ID="$1"
GIT_REF="${2:-main}"
SCHEMA_VERSION="${3:-v1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${SCRIPT_DIR}/../../src/public/schemas/seismic-model/${SCHEMA_VERSION}.json"
SUPPORTED_SCHEMA="https://collaborative-learning.concord.org/schemas/seismic-model/${SCHEMA_VERSION}.json"

RAW_BASE="https://raw.githubusercontent.com/${GITHUB_ORG}/${GITHUB_REPO}/${GIT_REF}/models/${MODEL_ID}"
S3_PREFIX="tiny-cnn-seismicML/models/${SCHEMA_VERSION}/${MODEL_ID}"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Error: Local schema file not found: $SCHEMA_FILE"
  echo "Schema version \"${SCHEMA_VERSION}\" is not published in this CLUE checkout."
  exit 1
fi

# Work in a temp dir that is cleaned up on exit
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Fetching model '${MODEL_ID}' from ${GITHUB_ORG}/${GITHUB_REPO}@${GIT_REF}..."
for file in metadata.json weights.json; do
  if ! curl -fsSL -o "${TMP_DIR}/${file}" "${RAW_BASE}/${file}"; then
    echo "Error: Failed to fetch ${RAW_BASE}/${file}"
    echo "Check that the model id and git ref exist on GitHub."
    exit 1
  fi
done

# Validate metadata before uploading anything
echo "Validating metadata.json..."
META_ID="$(jq -r '.id' "${TMP_DIR}/metadata.json")"
META_SCHEMA="$(jq -r '."$schema"' "${TMP_DIR}/metadata.json")"

if [ "$META_ID" != "$MODEL_ID" ]; then
  echo "Error: metadata id \"${META_ID}\" does not match requested model id \"${MODEL_ID}\"."
  exit 1
fi
if [ "$META_SCHEMA" != "$SUPPORTED_SCHEMA" ]; then
  echo "Error: metadata \$schema \"${META_SCHEMA}\" is not the supported schema."
  echo "Expected: ${SUPPORTED_SCHEMA}"
  exit 1
fi

# Validate the metadata instance against the checked-in JSON Schema
if ! node -e '
  const fs = require("fs");
  const Ajv = require("ajv");
  const schema = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    console.error("  " + ajv.errorsText(validate.errors, { separator: "\n  " }));
    process.exit(1);
  }
' "$SCHEMA_FILE" "${TMP_DIR}/metadata.json"; then
  echo "Error: metadata.json does not match schema ${SCHEMA_FILE}"
  exit 1
fi

# Refuse to overwrite an existing model — models are immutable once published
for file in metadata.json weights.json; do
  if aws s3api head-object --bucket "$S3_BUCKET" --key "${S3_PREFIX}/${file}" 2>/dev/null; then
    echo "Error: Model already exists at s3://${S3_BUCKET}/${S3_PREFIX}/${file}"
    echo "Models are immutable once published. Bump the model id instead."
    exit 1
  fi
done

# Record the exact commit deployed, for traceability
RESOLVED_SHA="$(curl -fsSL "https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_REPO}/commits/${GIT_REF}" | jq -r '.sha')"

for file in metadata.json weights.json; do
  aws s3 cp "${TMP_DIR}/${file}" "s3://${S3_BUCKET}/${S3_PREFIX}/${file}" --content-type "application/json"
done

echo ""
echo "Deployed model '${MODEL_ID}' (${GITHUB_ORG}/${GITHUB_REPO}@${RESOLVED_SHA})"
echo "  https://${S3_BUCKET}.concord.org/${S3_PREFIX}/metadata.json"
echo "  https://${S3_BUCKET}.concord.org/${S3_PREFIX}/weights.json"
