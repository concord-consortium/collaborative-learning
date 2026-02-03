# LLM Detector

Part of [Detector-Driven Notifications](detector-driven-notifications.md) — notifies researchers in real-time (~30s target latency) when students perform "interesting" actions during class, enabling timely interviews.

## Overview

LLM detectors use large language models prompted with researcher descriptions to detect semantically meaningful events. They're well-suited for detecting nuanced, hard-to-formalize behaviors.

**Example use cases:**
- "Find moments of insight or confusion"
- "Detect when a student appears to have a misconception"
- "Identify when students are having a productive disagreement"

**Key insight:** LLM detectors are the **starting point** for all detection. Rule-based and ML detectors are optimizations for patterns that need to run more efficiently. See [Detector Type Progression](detector-authoring.md#detector-type-progression).

**Related specs:**
- [Detector Authoring](detector-authoring.md) - How LLM detectors are built (researcher interview workflow)
- [ML Model Detector](detector-ml-model.md) - Optimization for patterns needing fast inference at scale
- [Rule-Based Detector](detector-rule-based.md) - Optimization for patterns that can be expressed as explicit rules

## How It Works

1. **Researcher describes the pattern** through the [Authoring Workflow](detector-authoring.md#the-authoring-workflow)
2. **LLM receives events** as they arrive (log events, history entries)
3. **LLM evaluates** whether the current state/trajectory matches the researcher's description
4. **If detected**, LLM emits notification with natural language explanation
5. **Memory persists** context for continuity across events

## State Management

LLM detectors may use:
- **Semantic memory**: Vector stores for recall of relevant past events
- **Prompt context**: Accumulated context about the student/class
- **Conversation history**: Prior LLM interactions for continuity

Unlike rule-based and ML detectors, LLM detectors can use the Query Tool to fetch additional context on demand (e.g., "what did other students do?", "what's the current document state?").

## Input/Output

### Input
- New events (log events, history entries)
- Memory/context from previous runs
- Access to Query Tool (MCP) for on-demand lookups

### Output
- Notifications with natural language explanations
- Updated memory to persist

## Query Tool

The Query Tool is an MCP tool that allows LLM detectors to:
- Look up current document state
- Query document history
- See what other students in the class are doing
- Access document summaries

This enables the LLM to "look around" for context when deciding whether an event is interesting.

## Prompt Engineering

The prompt is built from the [Authoring Workflow](detector-authoring.md#the-authoring-workflow):

**System prompt includes:**
- Description of CLUE's log events and history entry structure
- The researcher's description of what to detect
- Validated examples from the labeling process (few-shot)
- Instructions for output format (notification + explanation)

**Context window management:**
- Recent events are included directly in the prompt
- Older context is retrieved via Query Tool or vector search
- Window embeddings (see [Finding Similar Patterns](detector-authoring.md#finding-similar-patterns-vector-search)) enable "find events similar to this example"

**Prompt iteration:**
- As researchers validate more examples, prompts improve
- False positives/negatives inform prompt refinement
- Eventually, patterns may "graduate" to rules or ML for efficiency

## When to Keep Using LLM vs. Optimize

**Keep using LLM when:**
- Pattern is still being refined (active iteration with researcher)
- Detection volume is low (few classes, infrequent events)
- Pattern is highly nuanced and resists formalization
- Interpretability via natural language explanation is valuable

**Optimize to Rules/ML when:**
- Pattern is stable and well-understood
- High detection volume makes LLM cost prohibitive
- Latency requirements exceed LLM API response time
- Pattern can be expressed as rules or learned from examples

## Implementation Considerations

- **API latency**: LLM inference adds 1-5 seconds per evaluation. May need to batch events or be selective about what triggers evaluation.
- **Token costs**: Continuous monitoring of many students is expensive. Consider triggering LLM evaluation only after simpler pre-filters.
- **Context window**: Balance including enough context vs. cost. Use Query Tool for on-demand lookups rather than stuffing everything in the prompt.
- **Rate limits**: May need to queue evaluations during high-activity periods.
- **Reproducibility**: LLM outputs can vary. For consistency, use low temperature and structured output formats.

## Questions

- **Hybrid pre-filtering**: Should simple rules trigger LLM evaluation (e.g., "only evaluate when there's been a deletion spike") to reduce cost?

- **Streaming vs. batch**: Evaluate after every event, or batch events into time windows for periodic evaluation?

- **Multi-student context**: Can the LLM see what other students are doing to detect comparative patterns ("this student is behind peers")?
