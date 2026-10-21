# Detector Authoring

Part of [Detector-Driven Notifications](detector-driven-notifications.md) — notifies researchers in real-time (~30s target latency) when students perform "interesting" actions during class, enabling timely interviews.

## Overview

This spec describes how researchers build detectors, from initial idea to deployed detector. The core insight is that **LLM-based detection is the starting point**, with rule-based and ML detectors as optimizations for runtime efficiency.

Rather than requiring researchers to write code or label thousands of examples upfront, the system uses an LLM to interview researchers, find candidate patterns in historical data, and iteratively refine detectors based on feedback.

## The Authoring Workflow

### 1. Researcher Describes the Pattern

The researcher works with an LLM that understands the structure of CLUE's log events and history entries. The researcher describes what they want to detect in natural language:

> "I want to know when a student is struggling—they're trying things but nothing is working."

### 2. LLM Interviews the Researcher

The LLM asks clarifying questions to understand the pattern:

- "Can you point me to an example? Give me a student and document revision where you saw this."
- "What did you see at that point that told you they were struggling?"
- "Were there earlier revisions that led up to this? What was happening before?"

The researcher provides **document revision IDs** as concrete examples. They might also reference:
- Notes from classroom observations
- Video recordings of the class
- Their memory of watching the student work

### 3. LLM Analyzes and Searches

The LLM analyzes the example—looking at edit patterns, timing, content trajectory, and other signals in the data. It then searches historical data for similar patterns.

This search can use:
- **Vector similarity** on temporal embeddings (see [Finding Similar Patterns](#finding-similar-patterns-vector-search))
- **Rule-based filtering** to narrow the search space before similarity matching
- **Direct LLM analysis** of candidate time windows

### 4. Researcher Validates Candidates

The LLM presents 5-10 candidate examples:

> "I found these time windows that look similar to your example. For each one, tell me: Is this a good time to interview the student? If yes, what's the specific moment you'd want to catch them?"

The researcher labels each candidate:
- Yes/No: Is this the pattern?
- If yes: The specific revision ID when they'd want to interview

### 5. Iterative Refinement

Based on researcher feedback, the LLM refines its understanding:

- If too many false positives: "What distinguishes the good examples from the bad ones?"
- If missing examples: "Can you show me one I missed?"
- The LLM may adjust its approach—different features, different thresholds, different detector type

This cycle repeats until the researcher is satisfied with detection quality.

## Detector Type Progression

The LLM detector is the **source of truth**. Other detector types are optimizations.

```
┌─────────────────────────────────────────────────────────────┐
│                     LLM Detector                            │
│  - Most flexible, handles nuance                            │
│  - Expensive per-inference                                  │
│  - Starting point for all detection                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌───────────────────┐               ┌───────────────────┐
│   Rule-Based      │               │    ML Model       │
│  - Pattern is     │               │  - Pattern needs  │
│    articulable    │               │    generalization │
│  - Cheapest       │               │  - Faster than    │
│    runtime        │               │    LLM            │
│  - Most           │               │  - Handles        │
│    interpretable  │               │    variants       │
└───────────────────┘               └───────────────────┘
```

### When to Use Each Type

| Detector Type | Best For | Example |
|---------------|----------|---------|
| **LLM** | Complex patterns, early exploration, small-scale detection | "Find moments of insight" |
| **Rules** | Crisp, enumerable patterns; need for interpretability | "Deleted 3+ tiles in 1 minute" |
| **ML Model** | Patterns that need generalization; high-volume detection | "Struggling student" across many variants |

### The System Tries All Three

For a given detection task, the system can:

1. Start with LLM detection to validate the pattern works
2. Attempt to generate rules that capture the same pattern
3. Train an ML model on the labeled examples
4. Compare performance (precision, recall, cost) across all three
5. Recommend the best option or let the researcher choose

## Finding Similar Patterns (Vector Search)

Standard vector embeddings capture state at a point in time. For detecting behavioral patterns, we need embeddings that capture **temporal sequences**.

### Embedding Approaches

| Approach | What It Captures | Use Case |
|----------|------------------|----------|
| **Window embeddings** | Activity pattern in a time window (e.g., last 5 minutes) | "Lots of deletions followed by viewing peer work" |
| **Trajectory embeddings** | How document state evolved over N revisions | "Document grew, then shrank, then stagnated" |
| **Event sequence embeddings** | Ordered sequence of events with timing | [DELETE, DELETE, pause, VIEW_PEER, pause] |

### How Vector Search Enables the Workflow

1. Researcher provides example: "Student X, revisions 50-60, was struggling"
2. System creates embedding for that window/trajectory
3. Vector search finds similar windows across all historical data
4. Researcher reviews top matches, labels them
5. Labeled windows become:
   - Training data for ML models
   - Few-shot examples for LLM detection
   - Input for rule generation

### Temporal Relationships

The embedding model must capture not just "these events occurred" but:
- Event order
- Time gaps between events
- Rhythm of activity (bursts vs. steady vs. stalled)

Options include time-series embedding models (TS2Vec, etc.) or structuring input to include relative timestamps.

## Labeling Strategy

Traditional ML requires large labeled datasets upfront. This system inverts that:

### Start with One Example

The researcher provides a single concrete example. The LLM does the work of finding similar patterns.

### Validate, Don't Search

The researcher's job is to validate candidates the LLM finds, not to manually search through data. This is faster and less tedious.

### Each Round Builds Training Data

Every validated example becomes:
- A training example for future ML models
- A retrievable example for few-shot LLM prompts
- Evidence for or against generated rules

### Negative Examples Matter

The LLM should also find examples that are **not** the pattern but might look similar. The researcher confirming "no, this isn't struggling, this is productive exploration" is valuable training signal.

## Example: Struggling Student Detection

This example illustrates the workflow for a pattern that benefits from ML.

### The Pattern

**Struggling** = student is trying things, but those things aren't working.

This is easy to recognize when watching a replay but hard to express as simple rules.

### Why Rules Are Insufficient

Individual signals have innocent explanations:
- Long pause → could be thinking
- Deleting content → could be a better approach
- Viewing peer work → could be learning

Rules like "no events for 5 minutes" fire for thinking students AND struggling students.

### Why ML Helps

ML can learn the **combination** of signals that distinguish struggling from productive pauses:
- The trajectory over time (making progress vs. spinning)
- Multiple signals together (pause + deletion + more pause + peer viewing + still no progress)
- Comparison to typical student behavior

### The "Working" Prerequisite

Detecting struggling requires first detecting whether the student's work is "working":

| Domain | How to Detect "Working" |
|--------|------------------------|
| **Programming tile** | Run the program, check if output matches expected behavior |
| **Geometry** | Harder—may need LLM to assess if construction achieves the goal |

**Struggling** = repeated attempts that don't move toward working.

### Productive vs. Unproductive Struggling

Ideally we'd distinguish:
- **Productive struggling**: Working through difficulty, learning
- **Unproductive struggling**: Stuck, need intervention

This is harder. Start with detecting struggling at all; refine later.

## Integration with Detector Types

This authoring workflow produces detectors that plug into the [Detector Runner](detector-driven-notifications.md#pluggable-detector-interface) described in the main spec.

The authored detector—whether LLM, rules, or ML—receives events from the Event Stream Aggregator and outputs notifications when patterns are detected.

### Detector Metadata

Each authored detector should capture:
- **Name and description**: What it detects, in researcher-friendly terms
- **Author**: Who created it and when
- **Training examples**: The labeled examples used to build it
- **Type**: LLM / Rules / ML (and which is primary vs. fallback)
- **Performance metrics**: Precision/recall on validation set

## Open Questions

- **How do we handle curriculum-specific detection?** A "struggling" detector for geometry may differ from one for programming. Should detectors be curriculum-scoped?

- **How do we version detectors as they're refined?** Researchers may want to compare v1 vs. v2 of a detector.

- **Can researchers share detectors?** A detector built by one researcher might be useful to others studying similar phenomena.

- **How do we handle real-time vs. batch detection?** The authoring workflow uses historical data, but deployment is real-time. Are there gaps?
