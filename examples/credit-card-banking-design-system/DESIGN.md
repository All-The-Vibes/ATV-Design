# Vaultline Credit Card Banking Design System

Working name: **Vaultline Card**  
Artifact type: ATV Design example workspace  
Status: Concept design system for a credit-card banking app  
Affiliation: Fictional product; not affiliated with any card issuer, payment network, bank, or device platform.

## Style Prompt

Vaultline Card is a private, high-trust credit-card banking app for people who want premium credit controls without casino-like rewards, synthetic glass, or opaque financial status. The interface should feel like a secure banking terminal made warmer: basalt ink, limestone surfaces, fine brass rules, mint confirmation light, and editorial typography that treats money as serious information.

The memorable signature is the **ledger rail**: a narrow vertical status rail that runs through major surfaces and changes shape for safe, pending, warning, and locked states. It lets users understand financial state even when color is unavailable.

## Product Principles

1. **Money is never decorative first** — balances, due dates, APR context, fees, credit limit, and payment status must be legible before any ornamental treatment.
2. **Every risk state has a reason** — declined transactions, suspicious activity, frozen cards, over-limit warnings, and autopay failures always include plain-language cause and next action.
3. **Controls feel deliberate** — freeze card, reveal number, dispute charge, raise limit, and change autopay use guarded controls with explanatory copy.
4. **Rewards are quiet utility** — cashback, credits, and points are framed as progress toward statement credit, travel, or savings; no confetti or gambling patterns.
5. **Privacy is visible** — device/session labels, masked card data, last security check, and merchant data sharing controls remain one tap away.
6. **Local-first design handoff** — tokens, component contracts, and artifact examples live in the workspace as files, not hidden model memory.

## Token Architecture

Vaultline uses a three-layer token model:

```text
primitive value → semantic purpose → component decision
```

- **Primitive tokens** are raw colors, sizes, durations, and font stacks.
- **Semantic tokens** describe product intent: canvas, text, secure, caution, income, debt, due, focus.
- **Component tokens** bind semantic values to reusable UI pieces: card hero, transaction row, guarded action, reward meter, statement panel.

## Primitive Color Tokens

| Token | Hex | Purpose |
| --- | --- | --- |
| `primitive.color.limestone.50` | `#F8F4EA` | warm app canvas |
| `primitive.color.limestone.100` | `#EFE7D7` | secondary canvas and raised tint |
| `primitive.color.paper.0` | `#FFFDF7` | primary cards and sheets |
| `primitive.color.basalt.900` | `#171A18` | primary ink and dark card body |
| `primitive.color.basalt.700` | `#343833` | secondary ink on light surfaces |
| `primitive.color.basalt.500` | `#687066` | tertiary copy and metadata |
| `primitive.color.brass.500` | `#A98046` | premium edge, rewards, selected ledger mark |
| `primitive.color.mint.400` | `#9FE6BD` | secure success and verified states |
| `primitive.color.blueprint.500` | `#3F6F9F` | informational links and scheduled states |
| `primitive.color.clay.600` | `#A24B36` | warning, dispute, failed payment |
| `primitive.color.rose.600` | `#8F334A` | fraud or destructive lock state |
| `primitive.color.line.200` | `#DDD3BF` | dividers and hairlines |

## Semantic Tokens

| Token | Value | Usage rule |
| --- | --- | --- |
| `color.bg.app` | limestone.50 | full-screen background |
| `color.bg.surface` | paper.0 | cards, sheets, rows |
| `color.bg.surface-muted` | limestone.100 | grouped panels and disabled fields |
| `color.text.primary` | basalt.900 | headings, balances, totals |
| `color.text.secondary` | basalt.700 | row labels, settings text |
| `color.text.muted` | basalt.500 | metadata, helper text |
| `color.border.subtle` | line.200 | dividers, rails, table rules |
| `color.accent.value` | brass.500 | rewards, premium status, selected card edge |
| `color.state.secure` | mint.400 | verified, paid, card active |
| `color.state.info` | blueprint.500 | scheduled, pending, educational |
| `color.state.warning` | clay.600 | user action needed |
| `color.state.danger` | rose.600 | fraud, lock, destructive action |

### Color Rules

- Never rely on color alone. Every status uses color + icon/glyph + rail shape + text.
- Brass is reserved for earned value or active selection; it is not a generic CTA color.
- Mint means verified or safe, never promotional.
- Warning and danger copy must include what happened, why it matters, and the next safe action.

## Typography

| Role | Stack | Notes |
| --- | --- | --- |
| Display | `Fraunces`, `Georgia`, serif | hero numbers, section statements, marketing surfaces |
| UI | `IBM Plex Sans`, `Segoe UI`, sans-serif | app navigation, controls, body copy |
| Data | `Azeret Mono`, `Cascadia Code`, monospace | balances, transaction amounts, masked PAN, timestamps |

### Type Scale

| Token | Size / Line | Usage |
| --- | --- | --- |
| `type.display.xl` | 64 / 0.95 | desktop hero balance |
| `type.display.lg` | 48 / 1.0 | mobile hero balance |
| `type.heading.md` | 28 / 1.12 | screen headers |
| `type.heading.sm` | 20 / 1.2 | panel titles |
| `type.body.md` | 16 / 1.55 | body and row text |
| `type.body.sm` | 14 / 1.45 | helper text |
| `type.label` | 12 / 1.0, 0.12em | uppercase status labels |

- Numeric values use tabular numerals.
- Due dates and APR values must never be smaller than `type.body.sm`.
- Avoid all-caps paragraphs; reserve uppercase for labels under 24 characters.

## Spacing, Radius, Stroke, Elevation

| Token | Value | Purpose |
| --- | ---: | --- |
| `space.1` | 4px | glyph gap, rail inset |
| `space.2` | 8px | compact row internals |
| `space.3` | 12px | chips, label groups |
| `space.4` | 16px | control padding |
| `space.5` | 24px | card padding, section gap |
| `space.6` | 32px | screen rhythm |
| `space.7` | 48px | desktop group rhythm |
| `space.8` | 72px | hero / top-level spacing |
| `radius.control` | 14px | buttons, fields, chips |
| `radius.card` | 28px | credit card, metric cards |
| `radius.sheet` | 36px | modal sheets, statement panels |
| `stroke.hairline` | 1px | dividers and inner rules |
| `stroke.focus` | 2px | keyboard focus rings |

Elevation is quiet: one soft Y-axis shadow, one inner hairline, never stacked glass blur. Dark card surfaces use inset brass and mint details instead of large shadows.

## Layout System

### Mobile Banking Home

- Viewport target: 390 × 844.
- Page margin: 20px.
- Primary stack: card hero → payment status → quick controls → transactions.
- Bottom nav has 5 items maximum: Home, Card, Activity, Rewards, Settings.
- Thumb-zone controls must be at least 44px high.

### Desktop Account Center

- 12-column grid, 72px outer margin, 24px gutters.
- Left rail navigation, center ledger, right security/rewards aside.
- Balance and payment context remain in the first viewport.
- Transaction table uses sticky header and visible status rail.

### Ledger Rail

The ledger rail is a 4px vertical mark used on rows, sheets, and alerts.

| State | Shape | Color | Meaning |
| --- | --- | --- | --- |
| Safe | solid rounded rail | secure | paid, verified, active |
| Pending | dashed rail | info | authorization or scheduled payment |
| Warning | notched rail | warning | action needed |
| Locked | double rail | danger | frozen, suspected fraud, blocked |
| Value | short brass rail | value | reward, credit, offer |

## Component Specifications

### 1. Credit Card Hero

**Purpose:** The tactile anchor for the account.

- Ratio: 1.586:1, 28px radius.
- Required content: issuer-independent product mark, network placeholder, masked PAN, cardholder initials, status chip, available credit.
- Surfaces: basalt body with limestone micro-grain and brass edge line.
- States:
  - `active`: secure mint dot, “Active · verified today”.
  - `frozen`: locked double rail, controls disabled except unfreeze.
  - `needs-payment`: warning rail, due date and minimum payment visible.
  - `travel-mode`: info rail, country/date summary.
- Motion: reveal lifts 6px over 420ms; no spin, no dramatic parallax.

### 2. Balance Header

**Purpose:** Explain what the user owes and what happens next.

- Primary value: current balance.
- Required context: statement balance, minimum due, due date, autopay status.
- Never show “$0” without explaining whether it means paid, pending, or no statement generated.
- Empty state: “No statement yet” plus projected close date.

### 3. Payment Status Panel

**Purpose:** Turn anxiety into a clear timeline.

- Timeline states: statement closed → payment scheduled → payment sent → posted.
- Each step includes date, amount, and responsibility owner (user, bank, merchant).
- Failed state requires next action and safe retry CTA.
- Primary CTA examples: “Pay statement”, “Edit autopay”, “Retry payment”.

### 4. Transaction Row

**Purpose:** Make each charge auditable.

- Left: merchant monogram or category glyph in neutral square.
- Center: merchant, category, card/device, and location/data-sharing clue when relevant.
- Right: signed amount, status, reward indicator.
- Expanded row includes receipt, merchant contact, dispute route, and data controls.
- Fraud-suspected rows use locked double rail and explicit copy, not a red-only treatment.

### 5. Guarded Action Cell

**Purpose:** Make risky operations deliberate.

- Used for freeze card, reveal number, replace card, dispute, limit changes, cash advance settings.
- Required: label, consequence copy, authentication hint, state badge.
- Destructive state requires two-step confirmation and no icon-only controls.
- Disabled state explains what must happen to enable it.

### 6. Rewards Meter

**Purpose:** Show value without addiction loops.

- Default expression: “$42.18 available as statement credit”.
- Optional goals: travel fund, emergency buffer, grocery offset.
- Progress uses brass tick marks and text, no confetti or streak pressure.
- Offers must show eligibility, expiration, and merchant privacy implications.

### 7. Security Sheet

**Purpose:** Make privacy posture inspectable.

- Shows last login, trusted devices, virtual card count, data sharing toggles, and recent risk checks.
- Uses secure rail for normal state and locked rail for needed review.
- Do not bury “sign out all devices” below unrelated marketing.

## Interaction & Motion

| Motion token | Value | Use |
| --- | ---: | --- |
| `motion.fast` | 160ms | hover, focus, chip selection |
| `motion.control` | 220ms | buttons, toggles, guarded cells |
| `motion.panel` | 360ms | sheets, expanded transactions |
| `motion.hero` | 640ms | card and balance entrance |
| `easing.standard` | cubic-bezier(.2,.8,.2,1) | default UI |
| `easing.guard` | cubic-bezier(.16,1,.3,1) | guarded confirmation |

- Financial state changes should animate position and shape, not only opacity.
- Reduce-motion mode removes card lift and rail sweep; state changes happen instantly with text updates.
- Loading states use skeleton rows plus explicit copy like “Checking payment status”, never indefinite spinners alone.

## Accessibility & Compliance UX

- WCAG AA contrast is required for text and control states.
- Focus rings are visible on light and dark surfaces.
- All controls have labels and reachable keyboard order.
- Important numbers use full text labels for screen readers: “Current balance, two thousand four hundred eighteen dollars and sixty cents.”
- APR, fees, minimum due, autopay state, and payment due date must not be hidden behind hover-only UI.
- Error copy must avoid blame: say “We could not verify this merchant” instead of “Suspicious merchant”.

## Copy Voice

- Calm, direct, specific.
- Prefer verbs that describe safe action: verify, schedule, freeze, review, pay, limit.
- Avoid hype terms: unlock, win, jackpot, exclusive, instant approval.
- Examples:
  - “Payment scheduled for May 10.”
  - “Freeze this card on every device.”
  - “This charge is pending; the final amount may change.”
  - “Rewards available as statement credit.”

## Do Not Do

- Do not copy real bank, Apple Card, Visa, Mastercard, AmEx, or issuer trade dress.
- Do not use rainbow spend charts as the default visualization.
- Do not make minimum payment the visually dominant path.
- Do not hide APR, fees, due dates, or dispute consequences.
- Do not use gambling-like rewards animations.
- Do not assume cloud sync, telemetry, or hosted account flows.
