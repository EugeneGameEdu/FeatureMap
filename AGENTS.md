# AGENTS.md — Core Rules for AI Developers

## What We're Building

**FeatureMap** visualizes codebase as a map of features:
- **CLI** analyzes code → creates **clusters** (technical: folders/modules)
- **AI** groups clusters → creates **features** (architectural: "Code Analysis Engine")  
- **Web** visualizes the map (React Flow)

**Ouroboros:** We analyze ourselves with FeatureMap.

---

## Critical Rules

### File Size: MAX 300 LINES

**Hard limit.** If file exceeds 500 lines:
- Extract functions → `utils/`
- Extract types → `types/`
- Split by responsibility

Good: 5 files × 150 lines  
Bad: 1 file × 1750 lines ❌

---

## Code Patterns

**Pure functions:** No side effects, testable.  
**Composition > Classes:** Small composable functions.  
**Explicit > Implicit:** Clear what's happening.  
**Early returns:** Flat code, avoid nesting.

---

## Tech Stack

**CLI:** ts-morph, commander, yaml, chokidar, zod  
**MCP:** @modelcontextprotocol/sdk, yaml  
**Web:** react, @xyflow/react, vite, tailwindcss, shadcn/ui, lucide-react

---

## Anti-Patterns

❌ God files (utils.ts with 50 functions)  
❌ Premature optimization  
❌ Boolean soup: `func(true, false, true, false)`  
❌ Mutating inputs  
❌ Leaky abstractions

---

## Naming

**Files:** camelCase.ts, PascalCase.tsx, kebab-case.yaml  
**Functions:** verbs (parseFile, buildGraph)  
**Variables:** descriptive (clusters not cls)