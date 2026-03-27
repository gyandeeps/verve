# Design System Specification

## 1. Overview & Creative North Star: "The Clinical Console"

The Creative North Star for this design system is **The Clinical Console**. Unlike consumer-grade apps that rely on playful roundness or bright saturations, this system is built on the philosophy of _High-Fidelity Quiet_. It treats the user’s cognitive health as a mission-critical dashboard.

To break the "standard template" feel, we reject the rigid 12-column grid in favor of **intentional asymmetry**. Primary data visualizations should feel weighted and grounded, while utility controls are tucked into sophisticated, low-contrast side-bars. We move away from "UI as a container" and toward "UI as an integrated environment," where elements bleed into one another through tonal depth rather than hard stops.

## 2. Color Theory & Surface Logic

The palette is rooted in deep, obsidian slates, providing a low-glare environment that respects the user's circadian rhythm.

### The Palette

- **Neutral Base:** `background` (#0b1326) and `surface` (#0b1326).
- **Flow Blue:** `primary` (#adc6ff) and `primary_container` (#4d8eff). Use this to signify focus states and active deep-work sessions.
- **Stress Rose:** `secondary` (#ffb2b7) and `secondary_container` (#b50036). Use sparingly to indicate high cognitive load or burnout risks.
- **Success Green:** `tertiary` (#4edea3). Dedicated exclusively to local-first sync status and data integrity.

### The "No-Line" Rule

Traditional 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely by background shifts. To separate a sidebar from a main content area, use `surface_container_low` against a `surface` background. The eye should perceive the change in depth, not a drawn line.

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers. Use the tier system to "sink" or "lift" information:

1. **Level 0 (Base):** `surface` (#0b1326) – The canvas.
2. **Level 1 (Submerged):** `surface_container_lowest` (#060e20) – Use for inactive background tasks or secondary telemetry.
3. **Level 2 (Standard):** `surface_container` (#171f33) – The default state for primary data cards.
4. **Level 3 (Focused):** `surface_container_highest` (#2d3449) – Reserved for active modal elements or high-priority alerts.

### The Glass & Gradient Rule

Floating elements (e.g., Command Palettes, Tooltips) must use **Glassmorphism**. Combine `surface_variant` at 60% opacity with a `backdrop-blur` of 12px. For main Action Buttons, apply a subtle linear gradient from `primary` to `primary_container` to give the element "soul"—a tactile quality that flat hex codes lack.

## 3. Typography: The Editorial Engine

The system utilizes a dual-font strategy to balance human readability with technical precision.

- **Proportional (Inter):** Used for all `display`, `headline`, `title`, and `body` scales. Inter’s tall x-height ensures legibility even in the dimmest dark-mode settings.
- **Monospaced (Space Grotesk):** Used for `label-md` and `label-sm`. This is our "Technical Subtext." Use this for timestamps, bundle IDs, and local network latency metrics. It signals to the user that they are looking at raw, local-first data.

**Hierarchy as Identity:**

- **Display-LG (3.5rem):** Use for "Status Hero" numbers (e.g., current Focus Score).
- **Label-SM (0.6875rem):** Always set in Space Grotesk with 0.05em letter spacing. This provides an authoritative, "instrument-panel" aesthetic.

## 4. Elevation & Depth

In this design system, shadows are "Ambient Atmosphere" rather than structural tools.

- **Tonal Layering:** Hierarchy is achieved by stacking containers. A `surface_container_lowest` card placed on a `surface_container` creates a "recessed" look, suggesting the card is a physical slot in the dashboard.
- **The Ghost Border:** If an element requires more definition (e.g., an input field), use the `outline_variant` token at **15% opacity**. This creates a "Ghost Border" that is felt rather than seen. 100% opaque borders are strictly forbidden.
- **Shadow Construction:** Floating modals must use a shadow color derived from `on_surface` (deep blue-tinted) at 6% opacity, with a 32px blur and 16px Y-offset. This mimics a soft glow from the screen rather than a harsh drop shadow.

## 5. Components

### Cards & Data Modules

- **Constraint:** No dividers. Use **Spacing 8** (1.75rem) to separate internal content blocks.
- **Style:** Background set to `surface_container`. Corners at `md` (0.375rem) for a precise, "machined" look.
- **Sparklines:** Use `primary` for growth and `secondary` for stress spikes. Lines should be 1.5px thick with a subtle `primary` glow (5px blur).

### Action Elements (Buttons)

- **Primary:** High-contrast `on_primary` text on a `primary_container` background.
- **Tertiary (Ghost):** No background. Use `label-md` (Space Grotesk) to distinguish technical actions from user-flow actions.
- **Rounding:** All buttons use `sm` (0.125rem) or `md` (0.375rem). Avoid `full` (pill-shape) rounding, as it feels too "consumer-soft" for a technical app.

### Input Fields

- **Base:** `surface_container_low`.
- **Active State:** Transition the "Ghost Border" from 15% opacity to 40% `primary`.
- **Labeling:** Labels should always be `label-sm` (Space Grotesk) and positioned above the field, never as a placeholder.

### Network Status Indicator (Sync)

- A specialized component for local-first health. A small 8x8px circle.
- **Syncing:** Pulsing `primary` (Flow Blue).
- **Secured/Local:** Solid `tertiary` (Success Green).
- **Latency High:** Solid `secondary` (Stress Rose).

## 6. Do’s and Don’ts

### Do

- **Do** use asymmetrical margins (e.g., 20% left, 5% right) for editorial data layouts.
- **Do** use `Space Grotesk` for any value that is generated by the machine (IDs, hex codes, time).
- **Do** rely on `surface_container_lowest` to create "wells" for content to sit inside.

### Don’t

- **Don’t** use a pure black (#000000) background; it destroys the sophisticated slate depth.
- **Don’t** use standard Material Design shadows. Use Tonal Layering or Ghost Borders.
- **Don’t** use "pill" buttons. Keep corners sharp (`sm` or `md`) to maintain the "Professional Console" feel.
- **Don’t** use more than one `primary` action per screen. Use `tertiary` (Ghost) for everything else.
