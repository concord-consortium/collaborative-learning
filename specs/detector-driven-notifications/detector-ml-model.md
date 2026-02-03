# ML Model Detector

## Overview

ML model detectors use trained classifiers to detect patterns that are difficult to express as explicit rules. They're well-suited for recognizing complex behavioral patterns learned from historical labeled data.

**Example use cases:**
- "Detect struggling students based on interaction patterns"
- "Identify students who may be disengaged"
- "Recognize productive collaboration patterns"

## How It Works

*Details to be added.*

## State Management

ML detectors build up document state incrementally from history entries rather than querying for current state on each event. The model itself may also maintain internal state.

Key considerations:
- Model loading time (rules out Lambda/Firebase Functions)
- Feature extraction from event stream
- Model state vs. document state

## Input/Output

### Input
- New events (log events, history entries)
- Accumulated state from previous runs
- Pre-loaded model weights

### Output
- Notifications when model predicts interesting event
- Confidence scores
- Updated state to persist

## Model Training

*Details to be added.*

Topics to address:
- What historical data is available for training?
- How are training labels obtained?
- Model selection and evaluation
- Retraining cadence

## Implementation Considerations

- Large model load time requires persistent runtime (microVM likely)
- May need GPU access for some models
- Feature engineering from raw events
- Handling class imbalance (interesting events are rare)

## Questions

*Add detector-specific questions here as they arise.*
