# ML Model Detector

Part of [Detector-Driven Notifications](detector-driven-notifications.md) — notifies researchers in real-time (~30s target latency) when students perform "interesting" actions during class, enabling timely interviews.

## Overview

ML model detectors use trained classifiers to detect patterns that are difficult to express as explicit rules. They're well-suited for recognizing complex behavioral patterns that require generalization.

**Example use cases:**
- "Detect struggling students based on interaction patterns"
- "Identify students who may be disengaged"
- "Recognize productive collaboration patterns"

**Related specs:**
- [Detector Authoring](detector-authoring.md) - How ML detectors are built (training data workflow, labeling strategy)
- [Rule-Based Detector](detector-rule-based.md) - When rules are sufficient instead of ML
- [LLM Detector](detector-llm.md) - The starting point that ML optimizes

## When to Use ML vs. Rules

ML detectors are an **optimization of LLM detectors** for patterns that need to run efficiently at scale. See [Detector Type Progression](detector-authoring.md#detector-type-progression) for the full decision framework.

**Use ML when:**
- Rule complexity would explode (many interacting conditions)
- You need generalization to variants you didn't explicitly enumerate
- The pattern is defined by examples, not logic ("I know it when I see it")
- You're comparing to a distribution ("unusual compared to typical students")

**Use Rules when:**
- The pattern is crisp and enumerable
- You need interpretability (explain why it fired)
- Training data would be hard to obtain

## Training Data

ML detectors get training data through the [Detector Authoring Workflow](detector-authoring.md#the-authoring-workflow), not through bulk upfront labeling.

**The process:**
1. Researcher provides one example of the pattern
2. LLM finds similar patterns in historical data using [vector search on temporal embeddings](detector-authoring.md#finding-similar-patterns-vector-search)
3. Researcher validates candidates (yes/no + specific interview timepoint)
4. Each validation round builds the training set
5. When enough labeled data exists, train ML model

**Negative examples matter:** The LLM also finds examples that are *not* the pattern but look similar. Researcher confirmation of "this is NOT struggling" is valuable training signal.

## Example: Struggling Student Detection

This is a canonical ML use case. See [full walkthrough in Detector Authoring](detector-authoring.md#example-struggling-student-detection).

**Why ML helps:** "Struggling" involves combinations of signals (pauses + deletions + peer viewing + no progress) that would require many fragile rules to enumerate. ML can learn the pattern from examples.

**Key insight:** Detecting "struggling" requires first detecting "working" (is the student's work achieving the goal?). Then struggling = repeated attempts that don't move toward working.

| Domain | How "Working" Is Detected |
|--------|---------------------------|
| Programming tile | Run program, check if output matches expected behavior |
| Geometry | Harder—may need LLM to assess if construction achieves goal |

## How It Works

1. **Feature extraction**: Transform raw events and document state into features the model can use
2. **Inference**: Model classifies whether current state/trajectory matches the target pattern
3. **Notification**: If confidence exceeds threshold, emit notification with score

The model runs continuously, processing events as they arrive. Unlike LLM detectors, inference is fast (milliseconds) once the model is loaded.

## State Management

ML detectors build up document state incrementally from history entries rather than querying for current state on each event. The model may also maintain:

- **Feature buffers**: Rolling windows of recent events for temporal features
- **Document state**: Current state reconstructed from JSON-Patch history entries
- **Model state**: For models that update online (less common)

Key considerations:
- Model loading time (rules out Lambda/Firebase Functions—need persistent runtime)
- Feature extraction from event stream
- Checkpointing for crash recovery and multi-day sessions

## Input/Output

### Input
- New events (log events, history entries)
- Accumulated state from previous runs
- Pre-loaded model weights

### Output
- Notifications when model predicts target pattern
- Confidence scores
- Updated state to persist

## Feature Engineering

Features are extracted from the event stream and document state. The [Detector Authoring](detector-authoring.md) workflow helps identify which features matter.

**Temporal features** (from event patterns):
- Event counts in time windows (deletions per minute)
- Time gaps between events (pause duration)
- Event sequences (create → delete → create)
- Activity rhythm (burst vs. steady vs. stalled)

**Content features** (from document state):
- Document complexity (tile count, text length)
- Content trajectory (growing, shrinking, churning)
- For programming: does the program "work"?

**Comparison features** (relative to peers):
- Progress compared to class average
- Approach similarity to other students

## Model Architecture Options

| Approach | Best For | Notes |
|----------|----------|-------|
| **Gradient boosting** (XGBoost, LightGBM) | Tabular features, fast inference | Good starting point |
| **Sequence models** (LSTM, Transformer) | Temporal patterns in event sequences | More complex, needs more data |
| **Pre-trained embeddings + classifier** | Leveraging existing models (sentiment, etc.) | Hybrid with rule-based |

Start simple. Gradient boosting on hand-crafted features often outperforms complex models with limited training data.

## Implementation Considerations

- **Persistent runtime required**: Large model load time rules out Lambda/Firebase Functions. MicroVM likely.
- **GPU optional**: Most models for this use case don't need GPU. Reserve for large sequence models.
- **Class imbalance**: "Interesting" events are rare. Use techniques like SMOTE, class weights, or threshold tuning.
- **Retraining**: As researchers validate more examples, periodically retrain to incorporate new data.

## Questions

- **Online vs. batch inference**: Does the model update its weights as it sees new examples, or is it static between retraining cycles? (Static is simpler, likely sufficient.)

- **Interpretability**: Can the model explain why it flagged something? For researcher trust, some interpretability is valuable. Consider SHAP values or attention weights.

- **Model versioning**: How do we track which model version generated which notifications?
