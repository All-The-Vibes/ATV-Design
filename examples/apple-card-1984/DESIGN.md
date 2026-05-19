# Apple-Inspired Credit Card Banking Design System

Working name: **Aperture Card OS**  
Status: ATV Design demo concept system for a credit card banking app  
Relationship to Apple: **inspired by Apple-like restraint, material clarity, and Macintosh-era editorial confidence; not affiliated with or endorsed by Apple Inc. Do not use Apple logos, product names, proprietary icons, exact marketing copy, or copied trade dress.**

## Style Prompt

Created as an ATV Design demo, this premium credit card banking app feels as deliberate as a precision object: quiet surfaces, generous negative space, high-contrast typography, tangible controls, and calm motion. The system blends contemporary Apple-like simplicity with 1984 Macintosh-era optimism: monochrome interface logic, pixel-grid reveals, CRT scan discipline, and a sense that money management can be clear, private, and human.

## Core Principles

1. **Clarity before persuasion** — balances, payment status, limits, and risk states are always legible before decorative polish.
2. **One primary surface** — each screen has one hero surface: card, balance, transaction, or control panel. Everything else supports it.
3. **Physical controls** — freeze, pay, dispute, and limit controls should feel like guarded hardware switches, not casual links.
4. **Privacy is visible** — security state is a first-class visual layer through lock rails, verification pulses, and explicit device/session labels.
5. **Calm premium, not glossy luxury** — avoid jewel tones, gradients, and over-rendered glass. Use warm graphite, ceramic white, brushed nickel, and one phosphor accent.

## Color Tokens

| Token | Hex | Role |
| --- | --- | --- |
| `color.canvas` | `#F4F1EA` | App background, warm ceramic canvas |
| `color.surface` | `#FFFCF4` | Cards, sheets, elevated panels |
| `color.ink` | `#20211F` | Primary text and icons |
| `color.muted` | `#6E716B` | Secondary labels and metadata |
| `color.hairline` | `#D9D4C8` | Dividers and panel strokes |
| `color.graphite` | `#101312` | Premium dark surfaces and card body |
| `color.phosphor` | `#BDF7A8` | Secure/active accent, Macintosh-inspired screen glow |
| `color.copper` | `#C6A36F` | Rewards, card edge highlight, premium status |
| `color.warning` | `#9A4A34` | Disputes, risk, blocked states |
| `color.success` | `#2F6B4F` | Payments posted, verified states |

### Color Rules

- Use `phosphor` only for active, secure, or system-awake states.
- Use `copper` only for earned value: cashback, rewards, premium credit line, or metal-card edge.
- Dark mode is not pure black; use `graphite` warmed by `canvas` and `copper`.
- Transaction categories must derive from neutral tints, not rainbow charts.

## Typography

### App UI

- Primary UI stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, `system-ui`, sans-serif.
- Numeric/data voice: `SF Mono`, `ui-monospace`, `Cascadia Code`, monospace.
- Marketing/display voice: use a restrained editorial serif only for hero campaigns, never for dense banking UI.

### Video / Artifact Typography

- Display: `Newsreader` for manifesto-scale statements.
- Data/interface: `IBM Plex Mono` for terminal-like balances, codes, and rows.
- Weight contrast: 300 body / 800-900 display.
- Numeric columns always use tabular numbers.

## Spacing and Layout

| Token | Value | Use |
| --- | ---: | --- |
| `space.1` | `4px` | Micro offsets, icon gaps |
| `space.2` | `8px` | Compact inline spacing |
| `space.3` | `12px` | Row internals |
| `space.4` | `16px` | Card padding minimum |
| `space.5` | `24px` | Panel rhythm |
| `space.6` | `32px` | Section rhythm |
| `space.7` | `48px` | Screen groups |
| `space.8` | `72px` | Hero spacing |

- Mobile frame: 390 × 844, 24px page margin, 16px card gap.
- Desktop banking frame: 12-column grid, 72px outer margin, 24px gutters.
- Dialogs and sheet interiors use an 8px baseline grid.

## Radius, Stroke, and Elevation

| Token | Value | Role |
| --- | ---: | --- |
| `radius.control` | `12px` | Buttons, inputs, chips |
| `radius.card` | `28px` | Credit card and dashboard cards |
| `radius.sheet` | `36px` | Modal sheets and statement panels |
| `stroke.hairline` | `1px` | Dividers, window chrome |
| `stroke.focus` | `2px` | Keyboard focus, secure confirmation |

Elevation should feel like milled material: soft vertical shadow plus a thin inner hairline. Avoid glassmorphism blur stacks.

## Component System

### Credit Card Hero

- Aspect: 1.586:1.
- Front: graphite body, subtle copper edge, embossed product mark, masked PAN, secure-state dot.
- Motion: card lifts 8px and rotates at most 4° on hero reveal; never spin.
- States: `active`, `frozen`, `replaced`, `needs-payment`, `travel-mode`.

### Balance Header

- Primary number uses 52-64px on mobile hero, tabular numerals.
- Always show status copy under the number: "Payment scheduled", "Autopay on", or "Due in 9 days".
- Never show a balance without payment context.

### Transaction Row

- Left: merchant glyph or monogram in a neutral rounded square.
- Center: merchant, category, card/user/device metadata.
- Right: signed amount, pending/posted state, reward indicator when relevant.
- Risk states add a lock rail and one-line reason; do not rely on color alone.

### Control Cells

- Freeze card, set limit, reveal number, replace card, and dispute use guarded cells.
- Guarded cells require explicit labels and secondary explanatory text.
- Destructive/irreversible controls never appear as icon-only buttons.

### Rewards Module

- Rewards are expressed as progress toward intent: travel, emergency buffer, statement credit.
- Avoid casino-like confetti. A single copper shimmer or tick mark is enough.

## Motion System

- Entrance: object-first, text-second. Surfaces arrive before copy so the user knows where to look.
- Eases: `expo.out` for confident entrance, `sine.inOut` for privacy pulses, `power4.inOut` for Macintosh-inspired wipes.
- Timings: controls 160-220ms, panels 320-480ms, hero card 700-900ms.
- Retro inspiration: pixel shutters, scanline sweeps, window zooms, monochrome boot cues.
- Do not use infinite loops. Ambient motion must be finite and subtle.

## Accessibility

- Text contrast targets WCAG AA or better.
- Active financial states include text, icon, and shape treatment.
- Focus rings use `color.phosphor` on dark surfaces and `color.graphite` on light surfaces.
- Motion-reduced mode should remove scanline and wipe effects, replacing them with opacity/scale changes under 200ms.

## What NOT To Do

- Do not use Apple logos, exact product names, proprietary iconography, or copied UI screens.
- Do not use pure black/white unless required by export constraints.
- Do not use rainbow category charts, neon gradients, casino reward animations, or glossy fintech blobs.
- Do not hide fees, APR, due dates, or risk states behind premium styling.
- Do not introduce cloud/account/telemetry assumptions; this system is local-first and BYOK-compatible.

## Video Direction

The companion HyperFrames piece should feel like a lost 1984 product-film fragment: CRT bloom, mechanical shutters, monochrome windows, phosphor green system wake, and a premium card emerging from a pixel-grid banking interface. The film sells the design system through motion, not narration.

