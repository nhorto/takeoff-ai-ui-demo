# Multi-Agent Orchestration Research

## Overview

This document compiles research on multi-agent orchestration patterns and best practices, gathered from Anthropic, LangChain/LangGraph, CrewAI, Microsoft AutoGen, and industry sources (2024-2026). The goal is to inform architectural decisions for TakeoffAI's sub-agent system.

---

## Table of Contents

1. [The Fundamental Distinction: Workflows vs Agents](#1-the-fundamental-distinction-workflows-vs-agents)
2. [Orchestration Approaches](#2-orchestration-approaches)
3. [Framework Comparison](#3-framework-comparison)
4. [When to Use Each Approach](#4-when-to-use-each-approach)
5. [State Management Patterns](#5-state-management-patterns)
6. [Error Handling and Fault Tolerance](#6-error-handling-and-fault-tolerance)
7. [Complexity Trade-offs](#7-complexity-trade-offs)
8. [Decision Framework](#8-decision-framework)
9. [Application to TakeoffAI](#9-application-to-takeoffai)
10. [Sources](#10-sources)

---

## 1. The Fundamental Distinction: Workflows vs Agents

According to Anthropic's "Building Effective Agents" research, there's a critical architectural distinction:

| Approach | Description | Best For |
|----------|-------------|----------|
| **Workflows** | LLMs and tools orchestrated through predefined code paths | Predictable, well-defined problems with fixed subtasks |
| **Agents** | LLMs dynamically directing their own processes and tool usage | Open-ended problems where you cannot predict required steps |

**Key Insight**: Most production systems benefit from a hybrid approach - deterministic workflow control with agent intelligence at specific decision points.

---

## 2. Orchestration Approaches

### 2.1 Deterministic/Hardcoded Orchestration

The choice of which agent runs next is defined in the workflow code, not by the agents themselves.

**Characteristics:**
- Highest predictability and auditability
- Typically lower latency (fewer LLM calls for orchestration decisions)
- Easier to test and validate
- Control flow is explicit in code

**Example:**
```typescript
// Deterministic orchestration
async function runTakeoff() {
  const discoveryResult = await runDiscoveryAgent();
  const stairs = parseStairs(discoveryResult);

  const countingResults = await Promise.all(
    stairs.map(stair => runCountingAgent(stair))
  );

  return await runCompilationAgent(countingResults);
}
```

### 2.2 Dynamic/Model-Based Orchestration

An LLM (orchestrator) decides which agents to invoke based on context.

**Characteristics:**
- More flexible for complex, evolving requirements
- Higher cost and latency due to orchestration LLM calls
- Better suited for tasks where the solution path cannot be predetermined
- Can adapt to unexpected situations

**Example:**
```typescript
// Model-based orchestration
async function runTakeoff() {
  const orchestrator = new OrchestratorAgent();

  while (!orchestrator.isComplete()) {
    const decision = await orchestrator.decideNextAction(state);
    const result = await executeAgent(decision.agent, decision.params);
    state = await orchestrator.updateState(result);
  }

  return state.finalResult;
}
```

### 2.3 Hierarchical vs Flat Structures

**Hierarchical (Supervisor/Orchestrator-Worker):**
- Central orchestrator coordinates specialized workers
- Creates "layers of abstraction where each layer has a clear responsibility"
- Works best when you have multiple distinct domains, each with complex logic
- Better for maintaining control and ensuring task completion

**Flat (Peer-to-Peer):**
- Agents communicate directly without a central coordinator
- Better for collaborative brainstorming or debate scenarios
- Higher coordination complexity
- Risk of infinite loops or deadlocks without careful design

---

## 3. Framework Comparison

### 3.1 LangGraph

**Core Architecture:** Graph-based state machine; agents as nodes, edges define control flow

**Orchestration Style:** Flexible - supports both deterministic and dynamic patterns

**Key Patterns:**
- **Router Pattern**: Deterministic classification routes to specialized agents
- **Supervisor Pattern**: LLM-based orchestrator delegates to workers
- **Hierarchical Teams**: Nested supervisors for complex domains

**Strengths:**
- Fine-grained control over state and transitions
- Built-in support for human-in-the-loop
- Checkpoint and replay capabilities

### 3.2 CrewAI

**Core Architecture:** Flows + Crews; Flows provide deterministic backbone, Crews provide autonomous agent teams

**Key Concept - "Deterministic Backbone with Autonomous Bursts":**
> "A deterministic backbone dictating part of the core logic (Flow) then certain individual steps leveraging different levels of agents from an ad-hoc LLM call, a single agent to a complete Crew."

**Strengths:**
- Clear separation between orchestration (Flows) and execution (Crews)
- Built-in task delegation and result aggregation
- Easy to define agent roles and responsibilities

### 3.3 Microsoft AutoGen / Agent Framework

**Core Architecture:** Event-driven, asynchronous messaging; layered Core API + AgentChat API

**Orchestration Patterns:**
- **Sequential**: Agents execute in predefined order
- **Concurrent**: Parallel execution of independent agents
- **Group Chat**: Multi-agent conversation with turn management
- **Handoff**: Dynamic routing based on expertise
- **Magentic**: Plan-based orchestration with documented reasoning

**Strengths:**
- Strong support for asynchronous operations
- Built-in conversation management
- Flexible messaging patterns

### 3.4 Anthropic's Recommendations

**Core Architecture:** Orchestrator-Worker with parallel subagents; external memory for state

**Key Principles:**
1. Start simple, add complexity only when needed
2. Use deterministic safeguards (retry logic, checkpoints)
3. Let model intelligence handle graceful degradation
4. Scale effort to query complexity

**Production Approach (from their multi-agent research system):**
- Orchestrator spawns subagents for parallel research
- External memory stores plans and summaries
- Rainbow deployments avoid disrupting running agents
- System can resume from checkpoints after errors

---

## 4. When to Use Each Approach

### 4.1 Single Agent vs Multi-Agent

**Start with Single Agent When:**
- Task complexity is low and can be handled in a single reasoning context
- You need fast response times without coordination overhead
- Debugging simplicity is important
- You don't need compliance-driven separation

**Move to Multi-Agent When:**
- Hard security/compliance boundaries mandate architectural separation
- Different tasks need specialized agents that scale independently
- A single agent has too many tools and makes poor decisions about which to use
- Tasks require specialized knowledge with extensive context
- You need to enforce sequential constraints that unlock capabilities only after certain conditions are met

### 4.2 Pattern Selection Guide

| Pattern | When to Use | When to Avoid |
|---------|-------------|---------------|
| **Sequential** | Clear linear dependencies; progressive refinement | Parallelizable stages; needs backtracking |
| **Concurrent/Parallel** | Independent tasks; time-sensitive | Agents need to build on each other's work |
| **Router** | Clear input categories; deterministic classification | Need conversation-aware orchestration |
| **Supervisor/Orchestrator-Worker** | Multiple distinct domains; centralized workflow control | Agents need direct user conversations |
| **Handoff** | Optimal agent not known upfront; expertise emerges during processing | Simple rule-based routing would suffice |
| **Magentic/Plan-Based** | Open-ended problems; need documented plan before execution | Deterministic path known; time-sensitive |

### 4.3 Deterministic vs Model-Based Decision Matrix

| Factor | Favors Deterministic | Favors Model-Based |
|--------|---------------------|-------------------|
| **Workflow predictability** | Known phases and transitions | Unknown solution path |
| **Cost sensitivity** | High (fewer LLM calls) | Lower priority |
| **Latency requirements** | Strict | Flexible |
| **Debugging needs** | Critical | Less important |
| **Adaptability** | Not needed | Required |
| **Task complexity** | Well-defined subtasks | Open-ended exploration |

---

## 5. State Management Patterns

### 5.1 Memory Architecture Layers

| Layer | Scope | Purpose |
|-------|-------|---------|
| **Short-term** | Session/task-scoped | Active working context |
| **Long-term** | Persistent | Historical interactions, learned patterns |
| **Episodic** | Sequence-based | Temporally cohesive episodes for retrieval |
| **External Memory** | Shared storage | Cross-agent state, plans, summaries |

### 5.2 Key Patterns

**Serialized Turns:**
- Agents act one at a time in a fixed order
- Each reads the latest memory, then writes updates
- Avoids simultaneous write conflicts
- Simple but can be slow

**Publish/Subscribe:**
- Agents subscribe to relevant topics
- When state updates, subscribed agents refresh their local view
- More scalable for many agents
- Requires message broker infrastructure

**External Memory Storage:**
- Save research plans and summaries to external storage
- Prevents context loss when approaching token limits
- Enables resumption after failures
- Recommended by Anthropic for production systems

**Heterogeneous Memory:**
- Each agent maintains memory uniquely relevant to their role
- Rather than homogeneous shared memory
- Reduces noise and improves focus

**Context Handoffs:**
- When spawning fresh agents, pass summarized essential information
- Rather than full context
- Prevents context bloat across agent chains

### 5.3 Best Practices

1. **Partition memory** into private (agent-specific) and shared (cross-agent) tiers
2. **Use utility-based deletion** to prevent memory bloat
3. **Implement conflict resolution** for when agents arrive at incompatible conclusions
4. **Checkpoint regularly** to enable recovery from failures
5. **Define clear ownership** of state sections per agent

---

## 6. Error Handling and Fault Tolerance

### 6.1 Key Patterns

| Pattern | Description |
|---------|-------------|
| **Exponential Backoff Retries** | Retry failed operations with increasing delays |
| **Circuit Breakers** | If an agent repeatedly fails, isolate it instead of cascading failures |
| **Idempotency Tokens** | Prevent duplicate processing during retries |
| **Redundant Agents** | Backup agents that can take over if primary fails |
| **Checkpointing** | Regular state snapshots for recovery |
| **Graceful Degradation** | Adapt when tools fail rather than hard-failing |

### 6.2 Critical Failure Modes

1. **Retry Storms**: A cascade where retries multiply load by 10x within seconds
2. **Context Loss**: Agent loses critical information mid-task
3. **Infinite Handoff Loops**: Agents keep delegating without resolution
4. **Stale State**: Agents reasoning on outdated information
5. **Resource Exhaustion**: Token limits, API rate limits, memory limits

### 6.3 Anthropic's Production Approach

From their multi-agent research system:
- Combination of "deterministic safeguards like retry logic and regular checkpoints"
- Model intelligence handles graceful adaptation when tools fail
- Rainbow deployments to avoid disrupting running agents during updates
- System can "resume from where the agent was when the errors occurred"

---

## 7. Complexity Trade-offs

### 7.1 The Core Principle

From Anthropic:
> "Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short."

### 7.2 Cost Considerations

| System Type | Token Usage (relative) |
|-------------|------------------------|
| Single LLM chat | 1x (baseline) |
| Single agent with tools | ~4x |
| Multi-agent system | ~15x |

**Implication**: For economic viability, multi-agent systems require tasks where the value is high enough to justify the increased cost.

### 7.3 When Complexity Pays Off

Multi-agent systems are justified when:

1. **Performance gains are dramatic** - Anthropic's multi-agent research system outperformed single-agent Claude Opus 4 by 90.2%
2. **Parallelization reduces time** - Research time reduced by up to 90% through parallel subagents
3. **Task value is high** - Complex research, financial analysis, construction takeoffs
4. **Specialization genuinely improves results** - Each agent's focused context leads to better decisions
5. **Single agent is overwhelmed** - Too many tools, too much context, poor decisions

### 7.4 When to Stay Simple

- If a single agent with better prompting would solve the problem
- If the overhead of coordination exceeds the benefits of specialization
- If you're splitting agents without meaningful specialization
- If latency requirements are strict and multi-hop communication is too slow
- If the task doesn't benefit from parallelization

### 7.5 Evolutionary Approach

From Redis's analysis:
> "Begin with a single agent. When you hit a clear limitation (one domain needs deep expertise, or speed becomes an issue), split off one specialized agent. Then iterate. Don't start with ten agents; grow into that complexity."

---

## 8. Decision Framework

### 8.1 Decision Tree

```
Is the task straightforward with predictable workflow?
├── YES → Use single agent with good prompting
└── NO → Does the task have clear, distinct phases?
    ├── YES → Is the routing rule-based/deterministic?
    │   ├── YES → Use Deterministic Orchestrator (code-based)
    │   └── NO → Use Supervisor/Orchestrator-Worker (model-based)
    └── NO → Is the solution path known upfront?
        ├── YES → Use Sequential or Concurrent pattern
        └── NO → Does the task require iterative planning?
            ├── YES → Use Magentic/Plan-based pattern
            └── NO → Use Handoff pattern (dynamic routing)
```

### 8.2 Orchestrator Type Decision

```
Can you enumerate all possible workflow states and transitions?
├── YES → Deterministic Orchestrator (code)
│   - Lower cost
│   - Predictable behavior
│   - Easier debugging
│   - Faster execution
└── NO → Model-Based Orchestrator (LLM)
    - More flexible
    - Can handle unexpected cases
    - Higher cost
    - Less predictable
```

### 8.3 Parallelization Decision

```
Are there independent subtasks that don't depend on each other?
├── YES → Can be parallelized
│   └── Will parallelization provide meaningful time savings?
│       ├── YES → Implement parallel execution
│       └── NO → Sequential is fine
└── NO → Must be sequential
```

---

## 9. Application to TakeoffAI

### 9.1 Workflow Analysis

TakeoffAI's construction takeoff has a predictable workflow:

1. **Discovery Phase**: Scan PDF pages, identify all stairs
2. **Counting Phase**: For each stair, count treads and extract dimensions
3. **Compilation Phase**: Aggregate results into CSV and summary

**Characteristics:**
- Phases are known upfront ✓
- Each phase has clear inputs/outputs ✓
- Counting phase has independent subtasks (each stair) ✓
- Workflow doesn't change based on content ✓

### 9.2 Recommended Architecture

Based on the research, TakeoffAI fits the **Deterministic Orchestrator with Parallel Bursts** pattern:

```
┌─────────────────────────────────────────────────────────┐
│              DETERMINISTIC ORCHESTRATOR                 │
│                    (TypeScript code)                    │
│                                                         │
│  1. Load PDF, initialize state                          │
│  2. Run Discovery Phase (single agent, maxTurns=10)     │
│  3. Parse discovered stairs from state                  │
│  4. Launch Counting sub-agents IN PARALLEL              │
│  5. Wait for all to complete                            │
│  6. Run Compilation Phase (single agent)                │
│  7. Return results                                      │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Discovery  │      │  Counting   │      │ Compilation │
│    Agent    │      │   Agents    │      │    Agent    │
│             │      │  (parallel) │      │             │
│ - Scan PDF  │      │ - Stair 1   │      │ - Aggregate │
│ - Find all  │      │ - Stair 2   │      │ - Generate  │
│   stairs    │      │ - Stair 3   │      │   CSV       │
│ - Write to  │      │ - ...       │      │ - Summary   │
│   state     │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
```

### 9.3 Why This Architecture

| Decision | Rationale |
|----------|-----------|
| **Deterministic orchestrator** | Workflow is predictable; no need for LLM to decide "what's next" |
| **Parallel counting** | Each stair is independent; parallelization could reduce time by 70-80% |
| **Single discovery agent** | Needs holistic view of all pages to identify stairs |
| **Single compilation agent** | Needs to see all results to generate coherent output |
| **External state file** | Simple, debuggable, supports resumption |

### 9.4 Key Considerations for Implementation

1. **State Management**: Use existing `state.json` approach; each counting agent writes to its stair section

2. **Error Handling**: If one counting agent fails, others can complete; orchestrator handles partial results

3. **Context Handoff**: Each counting agent gets only the pages relevant to its assigned stair

4. **Parallelization Limit**: Consider limiting concurrent agents (e.g., 5 at a time) to avoid rate limits

5. **Progress Tracking**: Orchestrator can report completion percentage as agents finish

---

## 10. Sources

### Primary Sources

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Anthropic: How We Built Our Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Microsoft: AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Microsoft: Choosing Between Single-Agent and Multi-Agent](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ai-agents/single-agent-multiple-agents)

### Framework Documentation

- [LangChain: Multi-Agent Documentation](https://docs.langchain.com/oss/python/langchain/multi-agent/index)
- [LangChain: Supervisor Pattern](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents-personal-assistant)
- [LangChain: Router Pattern](https://docs.langchain.com/oss/python/langchain/multi-agent/router)
- [CrewAI Documentation](https://docs.crewai.com/en/introduction)
- [CrewAI: Agentic Systems Architecture](https://blog.crewai.com/agentic-systems-with-crewai/)
- [Microsoft AutoGen](https://microsoft.github.io/autogen/stable//index.html)
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview)

### Industry Analysis

- [Redis: Single-Agent vs Multi-Agent Systems](https://redis.io/blog/single-agent-vs-multi-agent-systems/)
- [MongoDB: Why Multi-Agent Systems Need Memory Engineering](https://www.mongodb.com/company/blog/technical/why-multi-agent-systems-need-memory-engineering)
- [Multi-Agent System Reliability Patterns](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/)
- [Camunda: Blending Deterministic and Dynamic Orchestration](https://camunda.com/blog/2025/02/operationalize-ai-deterministic-and-non-deterministic-process-orchestration/)
- [Netguru: Multi-Agent Systems vs Solo Agents](https://www.netguru.com/blog/multi-agent-systems-vs-solo-agents)

---

## Summary

The research consistently points to a hybrid approach: **deterministic backbone with autonomous bursts**. For TakeoffAI specifically:

1. **Keep the deterministic orchestrator** - Your workflow is predictable
2. **Parallelize the counting phase** - Independent tasks, big time savings
3. **Use external state** - Simple, debuggable, resumable
4. **Start simple, add complexity only when needed** - Anthropic's core principle

The current architecture direction is sound. The main opportunity is implementing effective parallel execution of counting agents while maintaining robust state management and error handling.
