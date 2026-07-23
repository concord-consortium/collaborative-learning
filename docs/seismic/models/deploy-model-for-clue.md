# Deploying Models for CLUE

Guide for deploying seismic classification models (metadata + weights) to S3 for use by the CLUE Wave Runner tile.

## Overview

CLUE loads models from S3 at runtime and only ever holds a model's URL, never the
model files. The **source of truth for the files is the ML repo**
([Denolle-Lab/tiny-cnn-seismicML](https://github.com/Denolle-Lab/tiny-cnn-seismicML)),
where each model is a folder `models/{model-id}/` containing:
- `metadata.json` — describes the model (architecture, classes, sample rate, etc.)
- `weights.json` — pretrained weights exported for TF.js

To deploy, `scripts/seismic/deploy-model.sh` fetches those two files from GitHub at a
given ref, validates the metadata against CLUE's checked-in JSON Schema, and uploads
them to the CDN path the Wave Runner tile fetches at runtime. Nothing is created or
copied locally in CLUE.

**S3 location:** `s3://models-resources/tiny-cnn-seismicML/models/{schema-version}/{model-id}/`

**Public URL:** `https://models-resources.concord.org/tiny-cnn-seismicML/models/{schema-version}/{model-id}/`

## Step 1: Author the model in the ML repo

Create and commit the model folder `models/{model-id}/` (`metadata.json` +
`weights.json`) in the ML repo, then push the ref you intend to deploy. The deploy
script reads the files from GitHub, so they must be pushed — an unpushed local commit
won't deploy. See that repo's `docs/generating-model-weights.md` for producing the
weights.

## Step 2: metadata.json

The model's `metadata.json` (in the ML repo) follows this template:

```json
{
  "$schema": "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json",
  "id": "{model-id}",
  "architecture": "compact",
  "class_names": ["Noise", "Earthquake"],
  "sampling_rate": 100,
  "window_duration": 60,
  "instrument_types": ["H", "L"],
  "weightsUrl": "./weights.json"
}
```

### Field reference

| Field | Description |
|-------|-------------|
| `$schema` | Schema version URL. Must be `v1.json` for the current format. |
| `id` | Stable identifier used in Firestore event paths. Bump (e.g., `compact-v2`) when retraining, so old events remain valid. |
| `architecture` | Must match a registered build function in CLUE. `"compact"` maps to `buildCompactModel` (3 conv blocks, ~12K params). |
| `class_names` | Output class names in model output order. `"Noise"` is special — the runner skips it when creating events. |
| `sampling_rate` | Expected input sample rate in Hz. Data at other rates is resampled by the runner. |
| `window_duration` | Seconds per classification window (e.g., 60s at 100 Hz = 6000 samples). |
| `instrument_types` | SEED instrument codes (2nd char of channel code). `H` = high-gain seismometer, `L` = low-gain. |
| `weightsUrl` | Path to weights file, relative to the directory containing metadata.json. |

The schema is defined by the `ModelMetadata` TypeScript interface at
`shared/seismic/seismic-model-types.ts`. Full design:
[ml-model-integration-design.md](../ml-model-integration-design.md).

## Step 3: Deploy

```bash
./scripts/seismic/deploy-model.sh <model-id> [git-ref] [schema-version]
```

- `<model-id>` — the model folder under `models/` in the ML repo, e.g. `compact-v2`
- `[git-ref]` — ML-repo ref to fetch from (default: `main`)
- `[schema-version]` — CDN schema-version segment (default: `v1`)

The script:
1. Fetches `metadata.json` and `weights.json` from
   `raw.githubusercontent.com/Denolle-Lab/tiny-cnn-seismicML/<git-ref>/models/<model-id>/`.
2. Checks that `metadata.id` matches `<model-id>` and that its `$schema` is the
   supported version.
3. Validates `metadata.json` against the checked-in JSON Schema
   (`src/public/schemas/seismic-model/<schema-version>.json`, via `node` + `ajv`).
4. Refuses to overwrite an existing model at the S3 location — models are immutable
   once published. Bump the model id (`compact-v2` → `compact-v3`) instead.
5. Records the resolved commit SHA, uploads both files with
   `--content-type application/json`, and prints the public URLs.

> The `[schema-version]`'s schema file must exist in this CLUE checkout. Publishing a
> new schema version is a separate, infrequent step handled by
> `scripts/seismic/deploy-model-schema.sh`; see
> [ml-model-integration-design.md](../ml-model-integration-design.md).

## Deployed models

| Model ID | Schema | Architecture | Classes | Deployed |
|----------|--------|--------------|---------|----------|
| `compact-v1` | v1 | compact | Noise, Earthquake | 2026-03-30 |
