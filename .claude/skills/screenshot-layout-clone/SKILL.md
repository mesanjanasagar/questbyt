# Skill: Screenshot Layout Clone

**Invoked by**: `/screenshot-layout-clone`

When the user provides a competitor or reference UI screenshot, extract **only the layout structure** — never their colors, fonts, shadows, or brand — then re-render it using Questbyt's existing design tokens and components.

---

## What You Extract From the Screenshot

Extract only these structural properties:

| Property | What to capture |
|----------|----------------|
| **Grid / Flex** | Row vs. column, number of columns, wrap behavior, alignment |
| **Spacing rhythm** | Gap between elements, section padding, visual density (compact / comfortable / spacious) |
| **Element hierarchy** | Heading → subheading → body → label → caption levels |
| **Component types** | Which kind of component each element maps to (card, table, badge, stat, form, modal…) |
| **Proportions** | Relative widths (sidebar narrow vs. content wide, 1/3 vs. 2/3 split, etc.) |
| **Interaction affordances** | Buttons, inputs, dropdowns, tabs, toggles — their count and placement |

**Never extract**: specific colors (hex, RGB), border-radius values, font names, box-shadow definitions, or pixel measurements from the screenshot. Map everything to tokens instead.

---

## Questbyt Token Reference

All tokens live in `packages/tailwind-config/index.js` and are available in every app.

### Color Palettes

```
brand.*      — navy  (50→950)   sidebar, top nav, primary surfaces
primary.*    — blue  (50→950)   action buttons, links, active states
accent.*     — amber (50→950)   CTAs, highlights, restaurant warmth
neutral.*    — warm gray (50→950)  backgrounds, borders, text
success.*    — green (50→900)   confirmed states
warning.*    — amber (50→900)   caution, pending
error.*      — red   (50→900)   destructive, failed
info.*       — sky   (50→900)   informational
surface.*    — DEFAULT/raised/overlay/sunken (all white or near-white)
```

### Semantic Foreground Tokens (use these for text, not raw neutral-*)

```
foreground              → neutral-900   primary body text
secondary-foreground    → neutral-700   supporting text
muted-foreground        → neutral-600   muted labels, captions, hints
subtle-foreground       → neutral-500   placeholder text, use on white only
primary-foreground      → white         text on primary-600 backgrounds
success-foreground      → success-800   text on success-50/100 surfaces
warning-foreground      → warning-900   text on warning-50/100 surfaces
error-foreground        → error-800     text on error-50/100 surfaces
info-foreground         → info-900      text on info-50/100 surfaces
accent-foreground       → accent-950    text on amber backgrounds
```

### Border Radius Scale

```
rounded-xs    4px   — tiny chips, micro badges
rounded-sm    6px   — compact elements
rounded       8px   — default (inputs, small cards)
rounded-md    10px  — medium cards
rounded-lg    12px  — standard cards, modals
rounded-xl    16px  — large cards, panels
rounded-2xl   20px  — overlays, large dialogs
rounded-3xl   24px  — full-width overlays
rounded-full  9999px — pills, avatars
```

### Shadow Scale

```
shadow-xs      — subtle lift (cards at rest)
shadow-sm      — standard card
shadow          — DEFAULT (dropdowns)
shadow-md      — elevated card on hover
shadow-lg      — floating elements
shadow-xl      — modals
shadow-2xl     — full-page overlays
shadow-primary — colored: primary-600 glow
shadow-accent  — colored: accent-500 glow
```

### Typography Scale

```
text-xs    0.75rem  / lh 1rem       — labels, captions
text-sm    0.8125rem/ lh 1.25rem    — body small, table cells
text-base  0.9375rem/ lh 1.5rem     — body default
text-lg    1.0625rem/ lh 1.625rem   — section subtitles
text-xl    1.1875rem/ lh 1.75rem    — page subtitles
text-2xl   1.375rem / lh 1.875rem   — KPI values, card numbers
text-3xl   1.75rem  / lh 2.25rem    — large stats
text-4xl   2.25rem  / lh 2.75rem    — hero numbers
text-5xl   3rem     / lh 3.5rem     — display
tracking-label  0.06em  — uppercase section labels (e.g. table headers)
```

### Z-Index Named Layers

```
z-base(0)  z-raised(10)  z-dropdown(100)  z-sticky(200)
z-overlay(300)  z-modal(400)  z-toast(500)  z-tooltip(600)
```
Use as CSS utilities (`.z-modal`) or Tailwind class (`z-[400]`).

### Animations

```
animate-fade-in       — appear with 4px upward drift
animate-slide-in-right — panel sliding in from right
animate-scale-in      — modal/dialog pop (spring easing)
animate-shimmer       — skeleton loading background sweep
animate-pulse-soft    — gentle opacity pulse
animate-spin-slow     — 2s rotation for loaders
```

---

## Existing Components in `@pos/ui`

**Always reuse these before creating anything new.**

Import from `@pos/ui`:
```tsx
import {
  Button, Badge, StatusBadge,
  Card, CardHeader, CardTitle, CardBody, CardFooter,
  KPICard,
  Input, Textarea,
  Modal,
  Table, EmptyState, type Column,
  Sidebar, type NavItem, type NavGroup,
  PageHeader, DashboardLayout,
  Spinner, FullPageSpinner, Skeleton, SkeletonCard, SkeletonRow,
  ToastProvider, useToast,
  cn,
} from '@pos/ui';
```

### `Button`
```tsx
<Button variant="primary|secondary|ghost|danger|accent|outline"
        size="xs|sm|md|lg|xl"
        loading={bool} icon={<Icon/>} iconPosition="left|right" fullWidth />
```

### `Badge` / `StatusBadge`
```tsx
<Badge variant="default|primary|success|warning|error|info|accent" size="sm|md" dot />
<StatusBadge status="pending|cooking|ready|completed|cancelled|paid|unpaid" />
```

### `Card` family
```tsx
<Card padding="none|sm|md|lg" hover bordered>
  <CardHeader><CardTitle>…</CardTitle></CardHeader>
  <CardBody>…</CardBody>
  <CardFooter>…</CardFooter>
</Card>
```

### `KPICard`
```tsx
<KPICard label="Revenue" value="AED 12,400" subValue="This month"
         trend={+8.3} trendLabel="vs last month"
         icon={<DollarSignIcon/>} iconColor="text-primary-600 bg-primary-50" />
```

### `Input` / `Textarea`
```tsx
<Input label="Name" hint="Optional hint" error="Required" icon={<SearchIcon/>} suffix="AED" />
<Textarea label="Notes" rows={3} />
```

### `Modal`
```tsx
<Modal isOpen={bool} onClose={fn} title="Dialog Title" size="sm|md|lg|xl|full"
       footer={<><Button variant="secondary" onClick={fn}>Cancel</Button><Button>Confirm</Button></>}>
  {children}
</Modal>
```
Uses `z-modal` (400). Backdrop: `bg-neutral-950/50 backdrop-blur-[2px]`.

### `Table`
```tsx
const columns: Column<RowType>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
];
<Table columns={columns} data={rows} keyExtractor={(r) => r.id}
       loading={bool} onRowClick={(r) => …}
       emptyState={<EmptyState title="No records" description="…" />} />
```

### `Sidebar`
```tsx
<Sidebar appName="Manager" navGroups={[{ label: 'Main', items: [{path:'/', label:'Dashboard', icon:<HomeIcon/>}] }]}
         username="Alice" userRole="Manager" onLogout={fn} collapsed={bool} />
```
Background: `brand-900`. Active nav: `primary-600`.

### `PageHeader` / `DashboardLayout`
```tsx
<DashboardLayout>
  <PageHeader title="Orders" description="…"
              breadcrumbs={[{label:'Home',href:'/'},{label:'Orders'}]}
              actions={<Button>New</Button>} />
</DashboardLayout>
```

### Loading states
```tsx
<Spinner size="xs|sm|md|lg|xl" />
<FullPageSpinner message="Loading…" />
<Skeleton className="h-4 w-24" />
<SkeletonCard />   // KPI-card shaped skeleton
<SkeletonRow />    // table row shaped skeleton
```

### `Toast`
```tsx
const { success, error, warning, info } = useToast();
success('Saved successfully', 'Optional description');
```
Positioned `bottom-4 right-4`, uses `z-toast` (500), `animate-slide-in-right`.

---

## CSS Utility Classes (from `globals.css` + app `index.css`)

```css
.page             p-6 min-h-full
.surface          bg-white rounded-xl border border-neutral-200 shadow-xs
.card             bg-white rounded-xl border border-neutral-200 shadow-xs p-4
.field-label      text-sm font-medium text-neutral-700 mb-1.5
.divider          border-t border-neutral-100
.th               text-xs font-semibold text-muted-foreground uppercase tracking-label py-3 px-4
.td               text-sm text-secondary-foreground py-3 px-4
.tr-hover         transition-colors hover:bg-neutral-50
.text-heading     text-xl font-bold text-neutral-900 tracking-tight
.text-subheading  text-base font-semibold text-neutral-800 tracking-tight
.text-caption     text-xs text-neutral-500
.text-label       text-xs font-semibold text-neutral-500 uppercase tracking-label
.btn-primary      (POS only) inline-flex … bg-primary-600 text-white rounded-lg
.btn-secondary    (POS only) bg-white border border-neutral-200 text-neutral-700
.btn-ghost        (POS only) transparent bg hover:bg-neutral-100
```

---

## Step-by-Step Process

**Step 1 — Structural decomposition**
Read the screenshot and identify:
- Overall page layout (sidebar+content? full-width? split panel?)
- Number and arrangement of major sections
- Component type for each visible element (card, table, modal, form, tabs, stat, etc.)
- Content hierarchy per section (title, subtitle, metric, label, action)

**Step 2 — Component mapping**
For each element in the screenshot, map it to an existing `@pos/ui` component or CSS utility class. Document the mapping in a comment block.

**Step 3 — Token selection**
Choose tokens from the Questbyt palette — never use hex/rgb literals:
- Background surfaces → `neutral-50`, `white`, `surface.*`
- Section headers → `text-heading` or `text-xl font-bold text-neutral-900`
- Body text → `text-neutral-700` or `text-secondary-foreground`
- Accent actions → `primary-600` (blue) or `accent-500` (amber)
- Status indicators → `success.*` / `warning.*` / `error.*` with matching `*-foreground`

**Step 4 — Output**

Provide:

1. **Token manifest** — a table of every token used and what it maps to
2. **New component list** — any component that had no `@pos/ui` match (explain naming convention used)
3. **JSX code** — complete, TypeScript-ready, using only imports from `@pos/ui` and Tailwind classes

---

## Output Format

```
## Layout: [Screen Name]

### Structural Decomposition
[Description of grid/flex arrangement extracted from screenshot]

### Component Mapping
| Screenshot element | Questbyt component | Notes |
|---|---|---|
| … | … | … |

### Token Manifest
| Role | Token used | Value |
|---|---|---|
| Page background | neutral-50 | #FAFAF9 |
| Card surface | white + border-neutral-200 + shadow-xs | … |
| Primary CTA | primary-600 → primary-700 hover | #2563EB |
| … | … | … |

### New Components Created
[List any; "None — all covered by @pos/ui" if applicable]

### JSX
\`\`\`tsx
[complete implementation]
\`\`\`
```

---

## Hard Rules

1. **No hardcoded colors.** Every color must be a Tailwind token from the Questbyt palette.
2. **No inline styles.** No `style={{ color: '#xxx' }}`.
3. **Reuse before creating.** Check every `@pos/ui` export before writing new markup.
4. **No invented shadows.** Use only the shadow scale above.
5. **No arbitrary font sizes.** Use only `text-xs` through `text-5xl` from the Questbyt scale.
6. **Status semantics.** Use `success.*` / `warning.*` / `error.*` for semantic states — never `green-*` / `yellow-*` / `red-*` directly.
7. **Brand color for sidebar/nav only.** `brand-*` is exclusively for `Sidebar` backgrounds and nav chrome — not for data content.
