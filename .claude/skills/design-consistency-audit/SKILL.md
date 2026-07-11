# Skill: Design Consistency Audit

**Invoked by**: `/audit-design`

Scan every frontend source file in the project and produce a structured report of design token violations — hardcoded colors, spacing, radii, font sizes, or shadows that bypass the Questbyt token system.

---

## What This Audits


The Questbyt design system defines all values in `packages/tailwind-config/index.js`. Any Tailwind class or inline style that uses a raw value instead of a token is a violation.

### Violation categories

| Category | Violation pattern | Correct token |
|----------|------------------|---------------|
| **Color — raw hex** | `#fff`, `#1C1917`, `rgb(…)`, `rgba(…)` | Any `neutral-*`, `primary-*`, `brand-*`, etc. |
| **Color — Tailwind non-system** | `green-*`, `red-*`, `yellow-*`, `blue-*`, `gray-*`, `slate-*`, `stone-*` | `success-*`, `error-*`, `warning-*`, `primary-*`, `neutral-*` |
| **Color — inline style** | `style={{ color: '…', background: '…' }}` | Tailwind token class |
| **Spacing — arbitrary** | `p-[14px]`, `mt-[22px]`, `gap-[7px]` | Use spacing scale: `p-3.5`, `mt-5.5`, `gap-2` |
| **Border radius — arbitrary** | `rounded-[10px]`, `rounded-[20px]` | `rounded-md`, `rounded-2xl` |
| **Border radius — Tailwind non-system** | `rounded-2` (doesn't exist), `rounded-3` | Use `rounded-xs` through `rounded-3xl` |
| **Font size — arbitrary** | `text-[13px]`, `text-[11px]` | `text-xs` (12px) or `text-sm` (13px) |
| **Font size — Tailwind non-system** | `text-6xl`, `text-7xl`, `text-9xl` | Not in Questbyt scale — use max `text-5xl` |
| **Shadow — arbitrary** | `shadow-[0_2px_8px_rgba(…)]` | `shadow-xs` through `shadow-2xl`, `shadow-primary`, `shadow-accent` |
| **Shadow — Tailwind non-system** | `drop-shadow-*` (filter shadows) | Use `shadow-*` box-shadow scale only |
| **Z-index — arbitrary** | `z-[999]`, `z-50`, `z-10` (raw) | `.z-overlay`, `.z-modal`, `.z-toast`, etc. (named layers) |
| **Transition — arbitrary** | `duration-[250ms]`, `ease-[cubic-bezier(…)]` | `duration-150`, `duration-200`, `ease-out`, `ease-spring` |
| **Text color — raw neutral** | `text-neutral-500` for semantic text | Use `text-muted-foreground`, `text-secondary-foreground`, etc. |
| **Component duplication** | Hand-written button/badge/card markup | Use `<Button>`, `<Badge>`, `<Card>` from `@pos/ui` |

---

## Allowed Exceptions

Some raw values are intentional. Do **not** flag:

- `z-[300]`, `z-[400]`, `z-[500]` when they match named layers (verify in `tailwind-config/index.js`)
- `animate-spin` (built-in Tailwind, not overridden)
- `opacity-*` values (not tokenized)
- `w-full`, `h-full`, `min-h-screen`, `max-w-*` (layout utilities, not design tokens)
- `border-3` if used with exact system spacing (borderWidth is not tokenized)
- SVG fill/stroke attributes (SVG attributes, not CSS classes)
- `bg-black/60`, `bg-neutral-950/50` (opacity modifiers on token colors — allowed)
- `text-[10px]`, `text-[11px]` inside POS Terminal `apps/pos-terminal` only (dense touchscreen UI legitimately needs sub-xs sizes; note but don't error)
- Any value inside `packages/tailwind-config/index.js` itself (it defines the tokens)
- Any value inside `*.config.cjs`, `vite.config.ts`, or build tooling

---

## Files to Scan

```
apps/*/src/**/*.{tsx,ts,jsx,js,css}
packages/ui/src/**/*.{tsx,ts,jsx,js,css}
```

Exclude:
```
**/node_modules/**
**/dist/**
**/*.config.{cjs,js,ts}
**/tailwind-config/**
**/*.test.*
**/*.spec.*
```

---

## Scoring Method

Score each file on a 0–100 scale per dimension. Report at file level.

### Dimensions

**Color score** (0–100)
- Start at 100
- −5 per hardcoded hex/rgb
- −3 per non-system Tailwind color class (green-*, red-*, etc.)
- −2 per inline style with color
- −1 per raw `text-neutral-500` used for semantic text (should be `text-muted-foreground`)

**Spacing score** (0–100)
- Start at 100
- −3 per arbitrary spacing value (`p-[14px]`, `mt-[22px]`, etc.)

**Radius score** (0–100)
- Start at 100
- −5 per arbitrary radius value (`rounded-[10px]`)
- −3 per out-of-scale Tailwind radius

**Typography score** (0–100)
- Start at 100
- −5 per out-of-scale font size (`text-[13px]`, `text-6xl`)
- −2 per line height or letter spacing override that duplicates a token

**Component reuse score** (0–100)
- Start at 100
- −10 per hand-rolled button that matches `<Button>` API
- −10 per hand-rolled badge/pill that matches `<Badge>` API
- −10 per hand-rolled modal overlay that matches `<Modal>` API
- −10 per hand-rolled spinner that matches `<Spinner>` API
- −10 per hand-rolled card wrapper that matches `<Card>` API
- −5 per hand-rolled table row that matches `<Table>` API

**Overall score** = average of all five dimensions.

---

## Output Format

### Summary table

```
## Design Consistency Audit — [date]

### Score Summary
| App / Package | Color | Spacing | Radius | Typography | Component Reuse | Overall |
|---|---|---|---|---|---|---|
| apps/pos-terminal | 88 | 95 | 100 | 92 | 74 | 90 |
| apps/manager-dashboard | 76 | 88 | 94 | 85 | 68 | 82 |
| apps/kiosk | … | … | … | … | … | … |
| apps/kds | … | … | … | … | … | … |
| packages/ui | … | … | … | … | — | … |
```

### Finding table (per file)

```
| File | Line | Category | Issue | Suggested fix |
|---|---|---|---|---|
| apps/pos-terminal/src/pages/POSPage.tsx | 482 | color:arbitrary | `bg-[#F5F5F4]` | `bg-neutral-100` |
| apps/manager-dashboard/src/pages/OrdersPage.tsx | 91 | color:non-system | `text-green-600` | `text-success-600` |
| apps/kiosk/src/pages/PaymentPage.tsx | 34 | radius:arbitrary | `rounded-[10px]` | `rounded-md` |
| … | … | … | … | … |
```

Rank findings: color violations → radius → spacing → typography → component reuse.

### Component duplication callouts

List hand-rolled components that replicate `@pos/ui` exports, with the exact file and the suggested replacement import.

### Top 5 worst files

List the 5 files with the lowest overall score, with their main issue category.

---

## Step-by-Step Execution

**Step 1 — Collect files**
```bash
find apps/*/src packages/ui/src -name "*.tsx" -o -name "*.ts" -o -name "*.css" \
  | grep -v node_modules | grep -v dist | grep -v "\.config\." | sort
```

**Step 2 — Grep violations by category** (run in parallel)

```bash
# Hardcoded hex colors
grep -rn '#[0-9a-fA-F]\{3,6\}' apps/*/src packages/ui/src \
  --include="*.tsx" --include="*.ts" --include="*.css" | grep -v "tailwind-config"

# Non-system Tailwind color classes (green, red, yellow, blue, gray, slate, stone)
grep -rEn 'class[Name]*=.*"[^"]*\b(green|red|yellow|blue|gray|slate|stone|indigo|violet|purple|pink|rose|teal|cyan|lime|orange|fuchsia|sky|emerald)-[0-9]' \
  apps/*/src packages/ui/src --include="*.tsx" --include="*.ts"

# Arbitrary values (spacing, radius, font)
grep -rEn '\[(([0-9]+px)|([0-9]+rem)|([0-9]+em))\]' \
  apps/*/src packages/ui/src --include="*.tsx" --include="*.ts"

# Inline styles with color/background
grep -rEn 'style=\{[^}]*(color|background|borderColor|fill|stroke)' \
  apps/*/src packages/ui/src --include="*.tsx" --include="*.ts"

# Raw z-index values (non-named)
grep -rEn 'z-\[([0-9]+)\]|z-(0|10|20|30|40|50)(?!0)' \
  apps/*/src packages/ui/src --include="*.tsx" --include="*.ts"

# Out-of-scale font sizes
grep -rEn 'text-(6xl|7xl|8xl|9xl|\[[0-9]+(px|rem)\])' \
  apps/*/src packages/ui/src --include="*.tsx" --include="*.ts"
```

**Step 3 — Component reuse scan**

Look for patterns that suggest hand-rolled duplicates of `@pos/ui` components:
- Button duplication: `<button className=".*bg-primary` without importing `Button`
- Badge duplication: `rounded-full` + `text-xs` + `px-2` + a semantic color class, without importing `Badge`
- Card duplication: `bg-white rounded-xl border border-neutral-200 shadow-xs` without importing `Card`
- Spinner duplication: `animate-spin` on a `div` without importing `Spinner`
- Modal duplication: `fixed inset-0` + `z-` overlay without importing `Modal`

Check each file's imports to determine if `@pos/ui` was already imported and just not used for this element.

**Step 4 — Score and rank**

Calculate per-file scores as described above. Sort by overall score ascending (worst first).

**Step 5 — Report**

Output the full report in the format above. Include:
- Summary score table
- Complete finding table sorted by severity
- Component duplication callouts
- Top 5 worst files

---

## Quick re-run after a screen

After finishing a new page or screen, run `/audit-design` to catch regressions before they accumulate. A file scoring below 80 overall needs cleanup before merge.

---

## Token Quick-Reference Card

Use this to suggest fixes inline in the finding table:

### Color replacements

| Violating class | Replacement |
|---|---|
| `text-green-*` | `text-success-*` or `text-success-foreground` |
| `text-red-*` | `text-error-*` or `text-error-foreground` |
| `text-yellow-*` | `text-warning-*` or `text-warning-foreground` |
| `text-blue-*` | `text-primary-*` or `text-info-*` |
| `text-gray-*` / `text-slate-*` / `text-stone-*` | `text-neutral-*` |
| `bg-green-*` | `bg-success-*` |
| `bg-red-*` | `bg-error-*` |
| `bg-yellow-*` | `bg-warning-*` |
| `bg-blue-*` | `bg-primary-*` or `bg-info-*` |
| `bg-gray-*` | `bg-neutral-*` |
| Semantic body text (`text-neutral-500`) | `text-muted-foreground` |
| Semantic body text (`text-neutral-700`) | `text-secondary-foreground` |
| Semantic body text (`text-neutral-900`) | `text-foreground` |

### Spacing replacements

| Arbitrary | Token |
|---|---|
| `p-[14px]` | `p-3.5` (14px) |
| `p-[18px]` | `p-[18px]` → no exact match, use `p-4` (16px) or `p-5` (20px) |
| `gap-[6px]` | `gap-1.5` (6px) |
| `mt-[22px]` | closest: `mt-5` (20px) or `mt-6` (24px) |

### Radius replacements

| Arbitrary | Token |
|---|---|
| `rounded-[4px]` | `rounded-xs` |
| `rounded-[6px]` | `rounded-sm` |
| `rounded-[8px]` | `rounded` (DEFAULT) |
| `rounded-[10px]` | `rounded-md` |
| `rounded-[12px]` | `rounded-lg` |
| `rounded-[16px]` | `rounded-xl` |
| `rounded-[20px]` | `rounded-2xl` |
| `rounded-[24px]` | `rounded-3xl` |

### Z-index replacements

| Raw | Named layer |
|---|---|
| `z-[100]` | `z-dropdown` |
| `z-[200]` | `z-sticky` |
| `z-[300]` | `z-overlay` |
| `z-[400]` | `z-modal` |
| `z-[500]` | `z-toast` |
| `z-[600]` | `z-tooltip` |
