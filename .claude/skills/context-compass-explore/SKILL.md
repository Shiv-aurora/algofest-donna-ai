---
name: context-compass-explore
description: Navigate and understand the codebase using pre-computed behavioral context. Use when exploring code, understanding architecture, finding related functions, or starting any coding task. Provides cross-module dependency maps that file reading misses.
---

# Context Compass: Explore

When exploring or understanding this codebase, use Context Compass MCP tools
instead of reading files for navigation.

## Workflow

1. Start by calling `get_project_overview` to see the module map, hottest
   functions, and key cross-module connections.

2. For a specific task, call `get_relevant_context` with your task description.
   This returns function bundles ranked by relevance, including:
   - Full source of the primary function
   - Signatures and relationship descriptions for connected functions
   - CO_EDIT connections: functions historically modified together
     (invisible to import/call analysis)

3. If you need deeper detail on a specific function, call `get_function_bundle`
   with the function name.

4. To find functions by name or keyword, use `search_functions`.

5. Only read files directly when you need to:
   - View the full implementation of a tunneled function (you have its signature
     from the bundle, read the file only if you need the full body)
   - Edit or modify code (you always need the real file for edits)
   - Verify something the bundle describes

## Key insight

This project's index includes CO_EDIT connections: function pairs that are
historically co-edited in git commits but have no structural link (no call,
no import, no inheritance). These represent real dependencies that every other
code navigation tool misses. Pay attention to CO_EDIT tunnels in bundle output.
