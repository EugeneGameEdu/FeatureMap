# FeatureMap Design System Rules

> **IMPORTANT:** This document defines the styling rules for the entire FeatureMap frontend.  
> All components MUST follow these rules. Do NOT create separate stylesheets or hardcode colors.

---

## 🎨 Color Palette: Clean Architectural

All colors are defined as CSS variables in `packages/web/src/index.css`.  

**NEVER hardcode hex colors in components.** Always use HSL variables through Tailwind or `hsl(var(--name))`.

### Core Variables

```css
BACKGROUNDS
--background       0 0% 100%        Main background (white)
--card             0 0% 100%        Cards, panels, nodes
--popover          0 0% 100%        Popovers, tooltips
--secondary        0 0% 96.1%       Secondary backgrounds, hover states

BORDERS
--border           0 0% 89.8%       Default borders (gray-200 equivalent)
--input            0 0% 89.8%       Input borders

TEXT
--foreground       0 0% 3.9%        Primary text (near-black)
--muted-foreground 0 0% 45.1%       Secondary text, labels
--card-foreground  0 0% 3.9%        Text on cards

PRIMARY (Black/Dark)
--primary          0 0% 9%          Primary actions, buttons
--primary-foreground 0 0% 98%       Text on primary buttons

ACCENT (Neutral Gray)
--accent           0 0% 96.1%       Accent backgrounds
--accent-foreground 0 0% 9%         Accent text

SEMANTIC
--destructive      0 84.2% 60.2%    Red - errors, delete actions
--destructive-foreground 0 0% 98%   Text on destructive buttons

FOCUS
--ring             0 0% 3.9%        Focus ring color
```

### Extended Semantic Colors (Hardcoded in Components)

```css
SOURCE INDICATORS
green-400, green-500    AI-generated features/clusters (border, icon)
green-100, green-700    AI badge backgrounds

purple-400, purple-500  User-created features/clusters (border, icon)
purple-100, purple-700  User badge backgrounds

gray-300, gray-400      Auto-generated (system) items

STATUS COLORS
blue-500, blue-300      Selected, focused, active states
blue-200, blue-100      Selection rings, hover states

amber-50, amber-100     Deprecated status backgrounds
amber-300               Warning, attention needed

gray-100, gray-500      Ignored status

LAYER COLORS
blue-100, blue-700      Frontend layer
amber-100, amber-700    Backend layer
gray-100, gray-600      Shared layer
indigo-100, indigo-700  Infrastructure layer

GROUPS & CONTAINERS
slate-50, slate-100     Group container backgrounds
slate-200, slate-800    Group borders and text
```

---

## ✅ DO

```tsx
// Use Tailwind color classes with semantic meaning
<div className="bg-white border border-gray-300 text-gray-800">

// Use HSL variables for shadcn components
<Button variant="default">Save</Button>

// Use conditional classes based on data
const borderColor = source === 'ai' 
  ? 'border-green-400' 
  : source === 'user' 
  ? 'border-purple-400' 
  : 'border-gray-300';

// Use cn() utility for combining classes
<div className={cn(
  "px-4 py-3 rounded-lg border-2",
  selected && "ring-2 ring-blue-200",
  className
)}>
```

## ❌ DON'T

```tsx
// NEVER hardcode hex colors directly
<div style={{ background: '#ffffff' }}>  // ❌ BAD

// NEVER create new color variables in components
const colors = { node: '#f3f4f6' };  // ❌ BAD

// NEVER use inline styles for colors
<div style={{ borderColor: '#10b981' }}>  // ❌ BAD

// NEVER create separate CSS files for components
// component.module.css  // ❌ BAD
```

---

## 📦 Component Styling Patterns

### Node Components (Clusters & Features)

```tsx
import { cn } from "@/lib/utils";
import { Handle, Position } from '@xyflow/react';
import { Box, Layers } from 'lucide-react';

export function CustomNode({ data, selected }: NodeProps) {
  const borderColor = selected
    ? 'border-blue-500'
    : data.source === 'ai'
    ? 'border-green-400'
    : data.source === 'user'
    ? 'border-purple-400'
    : 'border-gray-300';

  const bgColor = data.status === 'deprecated'
    ? 'bg-amber-50'
    : data.status === 'ignored'
    ? 'bg-gray-100'
    : 'bg-white';

  return (
    <div className={cn(
      "px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px]",
      "transition-all duration-150",
      borderColor,
      bgColor,
      selected && "shadow-md ring-2 ring-blue-200"
    )}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-400" />
      
      <div className="flex items-start gap-3">
        <Box className="text-gray-400" size={18} />
        <div className="flex-1">
          <div className="font-medium text-sm text-gray-800">{data.label}</div>
          <div className="text-xs text-gray-500">{data.fileCount} files</div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-400" />
    </div>
  );
}
```

### Sidebar Panels

```tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function Sidebar({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-[350px] border-l bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Content sections */}
        </div>
      </ScrollArea>
    </div>
  );
}
```

### Badges & Labels

```tsx
// Source badges
const sourceColors = {
  auto: 'bg-gray-100 text-gray-700',
  ai: 'bg-green-100 text-green-700',
  user: 'bg-purple-100 text-purple-700',
};

<span className={cn(
  "text-[10px] px-1.5 py-0.5 rounded font-medium uppercase",
  sourceColors[source]
)}>
  {source}
</span>

// Status badges
const statusColors = {
  active: 'bg-blue-100 text-blue-700',
  deprecated: 'bg-amber-100 text-amber-700',
  ignored: 'bg-gray-100 text-gray-500',
};

<Badge className={statusColors[status]}>
  {status}
</Badge>

// Layer badges
const layerColors = {
  frontend: 'bg-blue-100 text-blue-700',
  backend: 'bg-amber-100 text-amber-700',
  shared: 'bg-gray-100 text-gray-600',
  infrastructure: 'bg-indigo-100 text-indigo-700',
};
```

---

## 🗺️ Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (MapHeader)      bg-white border-b border-gray-200       │
│ - View toggle (Clusters/Features)                               │
│ - Layer filters (Frontend/Backend/Shared/Infrastructure)        │
│ - Group selector & filters                                      │
│ - Comments toggle                                               │
│ - Context editor toggle                                         │
│ - Search trigger                                                │
├─────────────────────────────────────────┬───────────────────────┤
│ LEFT TOOLBAR                            │ SIDEBAR (350px)       │
│ - Search button                         │ bg-white border-l     │
│ - Zoom controls                         │                       │
│ - Fit view                              │ When no selection:    │
│                                         │ - Project Overview    │
│ GRAPH CANVAS                            │ - Statistics          │
│ bg-gray-100                             │ - Tech Stack          │
│                                         │ - Conventions         │
│ Nodes:                                  │                       │
│ - Clusters: border-gray-300             │ When node selected:   │
│ - Features (AI): border-green-400       │ - Feature/Cluster     │
│ - Features (User): border-purple-400    │   details             │
│ - Selected: border-blue-500             │ - Metadata            │
│   + ring-2 ring-blue-200                │ - Files list          │
│                                         │ - Dependencies        │
│ Group Containers:                       │                       │
│ - bg-slate-50/70                        │ When group selected:  │
│ - border-slate-200                      │ - Group details       │
│ - rounded-xl                            │ - Members list        │
│                                         │ - Group note          │
└─────────────────────────────────────────┴───────────────────────┘
```

---

## 🧩 Common UI Elements

### Buttons (shadcn/ui)

```tsx
// Primary action
<Button variant="default">Save</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Ghost (minimal)
<Button variant="ghost">Options</Button>

// Icon button
<Button variant="ghost" size="icon">
  <Search size={16} />
</Button>
```

### Inputs

```tsx
<input 
  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
  placeholder="Search features..."
/>
```

### Section Headers

```tsx
<div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
  <h3 className="text-sm font-semibold text-gray-700">Section Title</h3>
  <Button variant="ghost" size="sm">Action</Button>
</div>
```

### Info Rows (Sidebar)

```tsx
<div className="flex items-start gap-2 text-sm">
  <FileCode size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
  <div className="flex-1 min-w-0">
    <div className="text-gray-500 text-xs">Files</div>
    <div className="font-medium text-gray-900">{fileCount}</div>
  </div>
</div>
```

### Group Containers

```tsx
<div className="w-full h-full rounded-xl border border-slate-200 bg-slate-50/70 shadow-sm">
  {/* Header */}
  <div className="px-4 py-2 border-b border-slate-200/80 bg-white/80 rounded-t-xl">
    <div className="text-sm font-semibold text-slate-800">{groupName}</div>
    <div className="text-xs text-slate-500">{description}</div>
  </div>
  
  {/* Optional Note Footer */}
  {note && (
    <div className="px-4 py-2 border-t border-slate-200/80 bg-slate-100/80 text-xs text-slate-600">
      {note}
    </div>
  )}
</div>
```

---

## 🎯 Interactive States

### Selection States

```tsx
// Node selection
className={cn(
  "border-2 transition-all",
  selected 
    ? "border-blue-500 shadow-md ring-2 ring-blue-200" 
    : "border-gray-300 hover:shadow-md"
)}

// List item selection
className={cn(
  "px-4 py-2 rounded cursor-pointer transition-colors",
  isSelected 
    ? "bg-blue-50 text-blue-900" 
    : "hover:bg-gray-50"
)}
```

### Hover States

```tsx
// Nodes
"hover:shadow-md"

// Buttons
"hover:bg-gray-50"

// List items
"hover:bg-gray-50"

// Group containers
"hover:ring-1 ring-blue-300"
```

### Focus States (Animated)

```tsx
// Focused file in list (from search/navigation)
const focusRing = isFocused
  ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-white animate-pulse'
  : '';
```

### Loading States

```tsx
<div className="flex items-center gap-2 text-gray-600">
  <RefreshCw className="animate-spin" size={20} />
  <span>Loading feature map...</span>
</div>
```

---

## 📝 Typography Scale

```tsx
// Page title
<h1 className="text-2xl font-bold text-gray-900">

// Section heading
<h2 className="text-lg font-semibold text-gray-900">

// Subsection
<h3 className="text-sm font-semibold text-gray-700">

// Node label
<div className="font-medium text-sm text-gray-800">

// Body text
<p className="text-sm text-gray-600">

// Secondary text
<span className="text-xs text-gray-500">

// Muted/helper text
<span className="text-xs text-muted-foreground">

// Tiny labels/badges
<span className="text-[10px] uppercase text-gray-400">

// Code/monospace
<code className="font-mono text-xs text-gray-800 bg-gray-100 px-1 py-0.5 rounded">
```

---

## 📁 File Organization

```
packages/web/
├── src/
│   ├── index.css                    # ✅ ALL CSS variables here
│   ├── App.tsx                      # Main app component
│   │
│   ├── components/
│   │   ├── FeatureNode.tsx          # Uses Tailwind + cn()
│   │   ├── Sidebar.tsx              # Uses Tailwind + cn()
│   │   ├── MapHeader.tsx            # Uses Tailwind + cn()
│   │   ├── SearchPalette.tsx        # Dialog with search
│   │   ├── GroupContainerNode.tsx   # Group visual containers
│   │   ├── ProjectOverview.tsx      # Sidebar overview panel
│   │   └── ui/                      # shadcn/ui primitives
│   │       ├── button.tsx
│   │       ├── badge.tsx
│   │       ├── dialog.tsx
│   │       └── scroll-area.tsx
│   │
│   └── lib/
│       ├── utils.ts                 # cn() utility
│       ├── types.ts                 # TypeScript types
│       └── loadFeatureMap.ts        # Data loading
│
├── tailwind.config.js               # Tailwind config (uses CSS vars)
└── components.json                  # shadcn/ui config
```

**Rule:** Components should NOT have their own `.css` or `.module.css` files. All styling is done via:
1. Tailwind utility classes: `bg-white border-gray-300`
2. The `cn()` utility for conditional classes
3. CSS variables from `index.css` for shadcn components

---

## 🎨 Source Indicator System

FeatureMap uses visual cues to indicate the origin of features and clusters:

### Border Colors by Source

```tsx
const getBorderColor = (source: 'auto' | 'ai' | 'user') => {
  switch (source) {
    case 'ai': return 'border-green-400';
    case 'user': return 'border-purple-400';
    case 'auto': return 'border-gray-300';
  }
};
```

### Icon Colors by Source

```tsx
const getIconColor = (source: 'auto' | 'ai' | 'user') => {
  switch (source) {
    case 'ai': return 'text-green-500';
    case 'user': return 'text-purple-500';
    case 'auto': return 'text-gray-400';
  }
};
```

### Badge Styling by Source

```tsx
const getBadgeClasses = (source: 'auto' | 'ai' | 'user') => {
  switch (source) {
    case 'ai': return 'bg-green-100 text-green-700';
    case 'user': return 'bg-purple-100 text-purple-700';
    case 'auto': return 'bg-gray-100 text-gray-700';
  }
};
```

**Consistency Rule:** Always use the same color for the same source across borders, icons, and badges.

---

## 🎭 Status Visual Language

### Background Colors by Status

```tsx
const getBgColor = (status: 'active' | 'deprecated' | 'ignored') => {
  switch (status) {
    case 'deprecated': return 'bg-amber-50';
    case 'ignored': return 'bg-gray-100';
    case 'active': return 'bg-white';
  }
};
```

### Status Badge Colors

```tsx
const statusBadgeColors = {
  active: 'bg-blue-100 text-blue-700',
  deprecated: 'bg-amber-100 text-amber-700',
  ignored: 'bg-gray-100 text-gray-500',
};
```

---

## 🏗️ Layer Visual System

```tsx
const layerBadgeColors = {
  frontend: 'bg-blue-100 text-blue-700',
  backend: 'bg-amber-100 text-amber-700',
  shared: 'bg-gray-100 text-gray-600',
  infrastructure: 'bg-indigo-100 text-indigo-700',
};

// Layer indicator in sidebar
<div className="flex items-center gap-1.5">
  <div className={cn(
    "w-2 h-2 rounded-full",
    layer === 'frontend' && "bg-blue-500",
    layer === 'backend' && "bg-amber-500",
    layer === 'shared' && "bg-gray-500",
    layer === 'infrastructure' && "bg-indigo-500"
  )} />
  <span className="text-xs text-gray-600 capitalize">{layer}</span>
</div>
```

---

## 🔧 When Creating New Features

Before writing any component, remember:

1. **Check index.css** for existing shadcn variables
2. **Use semantic Tailwind classes**: `bg-white`, `text-gray-800`, `border-gray-300`
3. **Use cn()** utility for conditional styling
4. **Follow source color conventions**: green for AI, purple for user, gray for auto
5. **NO new CSS files** – everything through Tailwind
6. **NO hardcoded hex** – use Tailwind color classes
7. **Use shadcn components** from `@/components/ui` when available
8. **Icons from lucide-react** for consistency

---

## 🎪 Animation Guidelines

### Transitions

```tsx
// Default transition for interactive elements
"transition-all duration-150"

// Hover/focus transitions
"transition-colors"

// Specific animations
"animate-spin"    // Loading indicators
"animate-pulse"   // Focus highlights
```

### Shadow Progression

```tsx
// Default
"shadow-sm"

// Hover
"hover:shadow-md"

// Selected/Active
"shadow-md"
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't Mix HSL Variables with Tailwind Colors

```tsx
// BAD - mixing styles
<div className="bg-background border-gray-300">

// GOOD - consistent approach
<div className="bg-white border-gray-300">
```

### ❌ Don't Create Inconsistent Source Indicators

```tsx
// BAD - using different colors for same source
<div className="border-green-300">  {/* AI should be green-400 */}
<Icon className="text-green-600" /> {/* AI should be green-500 */}

// GOOD
<div className="border-green-400">
<Icon className="text-green-500" />
```

### ❌ Don't Forget Mobile Considerations

```tsx
// BAD - fixed width might break on mobile
<div className="w-[350px]">

// GOOD - responsive
<div className="w-full sm:w-[350px]">
```

---

## 📊 Quick Reference Card

| Element | Use |
|---------|-----|
| Main background | `bg-gray-100` (canvas) or `bg-white` (panels) |
| Primary text | `text-gray-800` or `text-gray-900` |
| Secondary text | `text-gray-500` or `text-gray-600` |
| Muted text | `text-muted-foreground` or `text-gray-400` |
| Borders | `border-gray-200` or `border-gray-300` |
| AI indicator | `border-green-400` / `text-green-500` / `bg-green-100` |
| User indicator | `border-purple-400` / `text-purple-500` / `bg-purple-100` |
| Selection | `border-blue-500` + `ring-2 ring-blue-200` |
| Hover | `hover:bg-gray-50` or `hover:shadow-md` |
| Deprecated | `bg-amber-50` / `bg-amber-100` |
| Ignored | `bg-gray-100` / `text-gray-500` |
| Frontend layer | `bg-blue-100 text-blue-700` |
| Backend layer | `bg-amber-100 text-amber-700` |
| Group container | `bg-slate-50/70 border-slate-200` |

---

## 📐 Spacing Scale

```tsx
// Padding inside cards/panels
"p-4"          // 1rem (16px) - standard
"px-4 py-3"    // Nodes
"px-4 py-2"    // Compact rows

// Gaps between elements
"gap-2"        // 0.5rem (8px) - tight
"gap-3"        // 0.75rem (12px) - comfortable
"gap-4"        // 1rem (16px) - spacious

// Margins
"mt-1"         // Small vertical space
"mb-2"         // Medium vertical space
"space-y-4"    // Stack with consistent spacing
```

---

## 🎯 Accessibility Guidelines

### Focus Visible

```tsx
// Always provide visible focus states
"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

// For buttons
"focus-visible:ring-2 focus-visible:ring-blue-300"
```

### Color Contrast

- Always pair dark text on light backgrounds
- Use `text-gray-800` or darker for primary content
- Use `text-gray-600` or `text-gray-500` for secondary
- Ensure badges have sufficient contrast (100/700 combinations)

### Interactive Elements

```tsx
// Always make clickable areas clear
"cursor-pointer hover:bg-gray-50"

// Provide disabled states
"disabled:opacity-50 disabled:cursor-not-allowed"
```

---

## 📦 Component Library Reference

### Core UI (shadcn/ui)

- **Button** - All button variants and sizes
- **Badge** - Status and category indicators  
- **Dialog** - Modals and overlays (SearchPalette)
- **ScrollArea** - Scrollable containers (Sidebar)

### Icons (lucide-react)

- **FileCode, Folder, Box, Layers** - File/cluster icons
- **Search, X, RefreshCw** - UI controls
- **AlertTriangle, Clock, Tag, ArrowRight** - Status and navigation

### Graph (xyflow/react)

- **Node components** - Custom styled React Flow nodes
- **Handle** - Connection points with custom styling
- **Background** - Canvas background patterns

---

## 🎬 Before You Start Coding

Ask yourself:

1. ✅ Does this need a new component or can I reuse existing?
2. ✅ Am I using semantic Tailwind classes?
3. ✅ Am I following the source color conventions?
4. ✅ Am I using cn() for conditional classes?
5. ✅ Did I check if shadcn/ui has this component?
6. ✅ Am I maintaining consistency with existing patterns?
7. ✅ Will this look good on different screen sizes?

---

**Last Updated:** January 2026  
**Maintained by:** FeatureMap Team  
**Questions?** Check existing components in `packages/web/src/components/` for real examples.
