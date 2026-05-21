---
name: context-compass-review
description: Review code changes with behavioral blast radius analysis. Use when reviewing diffs, PRs, or recent changes. Surfaces cross-module impacts that structural analysis misses.
---

# Context Compass: Review Changes

When reviewing code changes, use Context Compass to find the full impact
including behavioral dependencies.

## Workflow

1. Identify the changed functions (from diff, staged files, or user description).

2. For each changed function, call `get_function_bundle` to see its connections:
   - CALLS/CALLED_BY: structural dependencies (also visible in imports)
   - CO_EDIT: behavioral dependencies (ONLY visible through Context Compass)
   - TEST: associated test files

3. CO_EDIT connections are the critical review targets. If function A changed
   and function B is a strong CO_EDIT connection (high PMI score), function B
   likely needs review too, even if there's no import or call between them.

4. Call `get_relevant_context` with a summary of all changes to get a
   prioritized list of everything that might be affected.

5. For each impacted function, check if the change breaks the expected
   interface or behavior described in the bundle's relationship labels.

## What to look for

- CO_EDIT connections that weren't included in the change (potential misses)
- Functions with high PMI scores to the changed code (strong behavioral coupling)
- Cross-module impacts (different file, different directory, but co-edited historically)
