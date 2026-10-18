# Mandatory Rule: Conversation History Logging & Continuous Memory Sync

**CRITICAL DIRECTIVE — MANDATORY FOR ALL AGENTS WORKING ON THIS WORKSPACE:**
You MUST ALWAYS follow this rule without any exception. It takes precedence over general behavioral defaults.

## 1. On Every User Prompt: Inspect & Analyze Memory First
- Immediately upon receiving any user prompt, inspect and analyze the project's permanent memory file:
  `D:\Projects\Markova Projects\Flex Pay\.agents\skills\Memory\memory.md`
- Review the historical context, architectural decisions, ongoing tasks, and user specifications before planning or modifying code.
- Maintain consistency with established project invariants:
  - FlexPay is an **Earned Wage Access (EWA) & Pre-Salary Credit** platform, **NOT** a personal loan app.
  - `monthly_salary` is a required field on employee creation and serves as the baseline credit limit.
  - Zero browser dialogs (`alert()`, `confirm()`, `prompt()`) — all UI must use in-system accessible modals/toasts.
  - Safaricom Ethiopia M-PESA validation (`+2517XXXXXXXX` or `07XXXXXXXX`).

## 2. On Every Agent Response: Append Prompt & Response to memory.md
- Before concluding your turn or delivering the response, you MUST append the exact user prompt and the agent's response to:
  `D:\Projects\Markova Projects\Flex Pay\.agents\skills\Memory\memory.md`
- Use the standard format:
  ```markdown
  #### Turn [Number] (Step [Index])
  ##### 👤 User Prompt:
  ```text
  <exact text of the user request>
  ```

  ##### 🤖 Agent Response:
  <comprehensive agent response, actions taken, and files changed>

  ---
  ```
- **Never skip this step** under any circumstances, regardless of the prompt size or type of request.
- **Never overwrite or delete** existing conversation history; always append.
