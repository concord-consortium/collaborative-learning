# LLM Detector

## Overview

LLM detectors use large language models prompted with researcher descriptions to detect semantically meaningful events. They're well-suited for detecting nuanced, hard-to-formalize behaviors.

**Example use cases:**
- "Find moments of insight or confusion"
- "Detect when a student appears to have a misconception"
- "Identify when students are having a productive disagreement"

## How It Works

*Details to be added.*

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

*Details to be added.*

Topics to address:
- How are researcher intentions translated to prompts?
- System prompt structure
- Handling prompt length limits
- Prompt versioning and testing

## Implementation Considerations

- API latency affects overall detection latency
- Token costs for continuous monitoring
- Balancing context window size vs. cost
- Handling rate limits
- Reproducibility challenges

## Questions

*Add detector-specific questions here as they arise.*
