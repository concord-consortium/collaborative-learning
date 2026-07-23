# Deploying Models for CLUE

Guide for deploying seismic classification models (metadata + weights) to S3 for use by the CLUE Wave Runner tile.

## Overview

CLUE loads models from S3 at runtime. Each model needs two files in `models/{model-id}/`:
- `metadata.json` — describes the model (architecture, classes, sample rate, etc.)
- `weights.json` — pretrained weights exported for TF.js

The deploy script validates metadata against the JSON Schema, then uploads both files to S3.

**S3 location:** `s3://models-resources/tiny-cnn-seismicML/models/{schema-version}/{model-id}/`

**Public URL:** `https://models-resources.concord.org/tiny-cnn-seismicML/models/{schema-version}/{model-id}/`

## Step 1: Create the model directory

```bash
mkdir -p models/{model-id}
```

## Step 2: Create metadata.json

Create `models/{model-id}/metadata.json` using this template:

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

The schema is defined by the `ModelMetadata` TypeScript interface in the CLUE repo at `shared/seismic/seismic-model-types.ts`. Full design: https://github.com/concord-consortium/collaborative-learning/blob/master/docs/seismic/ml-model-integration-design.md

## Step 3: Add the weights file

Copy the exported TF.js weights into the model directory:

```bash
cp path/to/exported_weights.json models/{model-id}/weights.json
```

For compact models, weights are exported by `scripts/export_compact_weights_for_tfjs.py`.

## Step 4: Deploy

```bash
./scripts/deploy-model.sh {model-id}
```

The script will:
1. Validate `metadata.json` against the JSON Schema (uses `scripts/validate-metadata.py`; requires `jsonschema` from `requirements.txt`)
2. Check that the model doesn't already exist in S3 (to prevent accidental overwrites)
3. Upload both files to S3 with `--content-type application/json`
4. Print the public URLs

## Deployed models

| Model ID | Schema | Architecture | Classes | Deployed |
|----------|--------|--------------|---------|----------|
| `compact-v1` | v1 | compact | Noise, Earthquake | 2026-03-30 |
