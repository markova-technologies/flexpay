---
name: memory
description: Persistent project memory and conversation history manager for Flex Pay. Ensures all user prompts and agent responses are systematically logged to memory.md and reviewed before taking action.
---

# Project Memory Skill (Flex Pay)

This skill manages continuous context persistence and conversation memory for the Flex Pay repository.

## Capabilities
1. **Historical Recall:** Provides complete access to all previous conversations, user prompts, agent decisions, and architectural specifications in [memory.md](file:///D:/Projects/Markova%20Projects/Flex%20Pay/.agents/skills/Memory/memory.md).
2. **Turn Logging:** Formats and appends every user prompt and agent response to `memory.md` upon completion of each turn.
3. **Context Analysis:** Evaluates project memory prior to implementing code changes to preserve architectural invariants (Earned Wage Access model, M-PESA Daraja security, Zero Browser Prompts, SplitEngine™ double-entry ledger).

## Usage Protocol
- Read [memory.md](file:///D:/Projects/Markova%20Projects/Flex%20Pay/.agents/skills/Memory/memory.md) whenever starting work on a new prompt to catch up on project context.
- Append new turns directly to the bottom of [memory.md](file:///D:/Projects/Markova%20Projects/Flex%20Pay/.agents/skills/Memory/memory.md) following the standardized format:
  ```markdown
  #### Turn [Number] (Step [Index])
  ##### 👤 User Prompt:
  ```text
  <prompt text>
  ```

  ##### 🤖 Agent Response:
  <response text>

  ---
  ```
