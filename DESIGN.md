---
name: Industrial Precision System
colors:
  surface: '#faf9fc'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f6'
  surface-container: '#eeedf1'
  surface-container-high: '#e9e8eb'
  surface-container-highest: '#e3e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#73777f'
  outline-variant: '#c3c6cf'
  surface-tint: '#436085'
  primary: '#123356'
  on-primary: '#ffffff'
  primary-container: '#2c4a6e'
  on-primary-container: '#9cbae4'
  inverse-primary: '#abc9f3'
  secondary: '#875200'
  on-secondary: '#ffffff'
  secondary-container: '#fead48'
  on-secondary-container: '#6f4300'
  tertiary: '#003b21'
  on-tertiary: '#ffffff'
  tertiary-container: '#005431'
  on-tertiary-container: '#7cc799'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#abc9f3'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#2a486c'
  secondary-fixed: '#ffddba'
  secondary-fixed-dim: '#ffb866'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#673d00'
  tertiary-fixed: '#a6f3c2'
  tertiary-fixed-dim: '#8bd7a7'
  on-tertiary-fixed: '#002110'
  on-tertiary-fixed-variant: '#005230'
  background: '#faf9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e3e2e5'
typography:
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Archivo Narrow
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 16px
  gutter: 12px
  row-height-dense: 32px
  row-height-standard: 40px
---

## Brand & Style
The design system is engineered for high-stakes industrial environments, drawing direct inspiration from avionics dashboards and precision instrumentation. The brand personality is authoritative, reliable, and strictly functional. It prioritizes information density and clarity over aesthetic decoration, ensuring that warehouse and production floor operators can process complex data streams with zero ambiguity.

The visual style is **Corporate / Modern** with a lean towards **Technical Minimalism**. It avoids all contemporary "soft" trends such as glassmorphism, shadows, or gradients. Instead, it relies on hairline borders, rigid grid structures, and a clear typographic hierarchy to create a sense of professional-grade stability. The UI should feel like a piece of high-end industrial equipment: rugged, precise, and efficient.

## Colors
The color palette is strictly utility-driven. The background uses a cool near-white to reduce eye strain under industrial lighting. 

- **Primary (Steel Blue):** Reserved for primary actions, navigation states, and structural identifiers.
- **Alert (Amber):** Used for caution, high-priority tasks, or items requiring immediate attention without being critical failures.
- **Success (Green):** Indicates completed cycles, active machinery, or valid data entry.
- **Error (Red):** Used for system failures, depleted inventory, or critical safety alerts.
- **Neutrals:** Text and borders use a high-contrast grayscale to maintain legibility in high-density data tables.

## Typography
Typography is split by functional role to aid rapid scanning:
- **Headers & Labels:** Archivo Narrow provides a technical, space-efficient feel. Small caps are used for metadata labels to distinguish them from the data values they describe.
- **General UI & Tables:** Inter is used for its superior legibility at small sizes in dense tabular formats.
- **Technical Data:** IBM Plex Mono is mandated for all non-prose data including Serial Numbers, SKUs, Timestamps, and Coordinates to prevent character confusion (e.g., '0' vs 'O', '1' vs 'l').

## Layout & Spacing
The system utilizes a **fixed grid** approach with high-density spacing based on a 4px baseline. 

- **Desktop:** 12-column grid, 12px gutters, 24px outer margins. Panels are typically fixed-width or snap to column increments.
- **Data Density:** Vertical rhythm is tight. Standard table rows are 40px, while "Dense" modes (for large inventory lists) drop to 32px.
- **Structure:** Content is organized into "Modules" separated by 1px hairline borders (#E2E5E9). Negative space is used strategically to group related data, but overall whitespace is kept to a functional minimum to maximize visible information.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Borders** rather than shadows. 
- **Level 0 (Background):** #F7F8FA.
- **Level 1 (Surface):** #FFFFFF – Used for cards, table bodies, and input fields.
- **Level 2 (Header/Overlay):** #F1F2F4 – Used for table headers and sidebars.

Separation is achieved through 1px solid borders. There are no shadows in the system. When an element is "raised" (like a modal), it is defined by a thicker 2px border or a high-contrast overlay, maintaining a flat, industrial aesthetic.

## Shapes
The shape language is rigid and geometric. 
- **Standard Corners:** 4px radius for buttons, input fields, and small containers.
- **Large Containers:** 6px radius for primary dashboard modules.
- **Square:** 0px radius is acceptable for table cells and internal dividers to reinforce the "instrument cluster" appearance.

## Components
- **Data Plate Header:** A specialized component for record views. A #2C4A6E top-border strip. Left-aligned: Serial ID in IBM Plex Mono (Bold). Right-aligned: 3-4 metadata clusters (e.g., Status, Priority) featuring a `label-caps` descriptor above a `body-md` value.
- **Buttons:** Solid #2C4A6E background with white text for primary actions. Secondary buttons use a 1px border with no fill. Labels must be verb-oriented (e.g., "DISPATCH ORDER").
- **Status Indicators:** A 8px solid circular dot using the system semantic colors (Green, Amber, Red) followed by `body-sm` text.
- **Input Fields:** Rectangular with 1px #E2E5E9 borders. On focus, the border changes to 1px #2C4A6E. No glow or shadow.
- **Data Tables:** No vertical lines between columns; use horizontal lines only (#E2E5E9). Header row uses #F1F2F4 background with `label-caps` text.
- **Chips/Badges:** Square-edged or 2px radius. Light tinted backgrounds with dark text for categorizing SKUs or Warehouse Zones.