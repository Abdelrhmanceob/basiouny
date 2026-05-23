---
name: Sacred Explorer
colors:
  surface: '#0f1412'
  surface-dim: '#0f1412'
  surface-bright: '#353a38'
  surface-container-lowest: '#0a0f0d'
  surface-container-low: '#181d1a'
  surface-container: '#1c211e'
  surface-container-high: '#262b29'
  surface-container-highest: '#313633'
  on-surface: '#dfe4e0'
  on-surface-variant: '#c0c9c1'
  inverse-surface: '#dfe4e0'
  inverse-on-surface: '#2c322f'
  outline: '#8a938c'
  outline-variant: '#404943'
  surface-tint: '#9cd2b5'
  primary: '#9cd2b5'
  on-primary: '#003825'
  primary-container: '#06402b'
  on-primary-container: '#77ac90'
  inverse-primary: '#356850'
  secondary: '#87d7a8'
  on-secondary: '#003921'
  secondary-container: '#01623c'
  on-secondary-container: '#8adaab'
  tertiary: '#e9c349'
  on-tertiary: '#3c2f00'
  tertiary-container: '#cba72f'
  on-tertiary-container: '#4e3d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b8efd0'
  primary-fixed-dim: '#9cd2b5'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#1b503a'
  secondary-fixed: '#a3f4c3'
  secondary-fixed-dim: '#87d7a8'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005231'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#0f1412'
  on-background: '#dfe4e0'
  surface-variant: '#313633'
typography:
  display-lg:
    fontFamily: IBM Plex Sans
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies the "Sacred Explorer"—a fusion of timeless Islamic scholarship and futuristic digital archiving. The visual language bridges the gap between the ancient and the avant-garde, creating a digital sanctuary that feels both infinite and intimate.

The aesthetic follows a **Modern-Islamic** movement: a blend of high-end minimalism and glassmorphism, enriched by mathematical geometric motifs. Instead of heavy physical textures, the system uses light and transparency to create depth. Every interaction should evoke a sense of reverence and discovery, utilizing "Golden Glows" to highlight active paths of knowledge, moving away from the coldness of typical cyberpunk into a warm, enlightened technological future.

## Colors
The palette is rooted in a "Deep Emerald" foundation, representing growth and the traditional color of Islamic heritage. 

- **Primary (Deep Emerald):** Used for the deepest layer of the interface, providing a rich, scholarly atmosphere.
- **Secondary (Royal Green):** Used for elevated surfaces and interactive elements to provide subtle tonal contrast.
- **Accent (Metallic Gold):** Reserved for "Enlightenment" states—active navigation, primary buttons, and critical highlights. It is often applied as a soft glow rather than a flat fill.
- **Background:** A near-black Obsidian (#0A0F0D) is used for the base canvas to ensure the emerald gradients and gold glows pop with maximum luminosity.

## Typography
The system utilizes **IBM Plex Sans** for its exceptional clarity and systematic structure, particularly in its Arabic and Latin pairings. 

Typography should be treated with generous leading (line height) to ensure readability of dense archival texts. Display titles should use a slightly tighter letter spacing for a more "monumental" feel, while labels and metadata use increased tracking to maintain legibility against dark, textured backgrounds. Use Metallic Gold for primary headers to signify their importance in the hierarchy.

## Layout & Spacing
The layout follows a **structured fixed-grid** philosophy, mirroring the precision of Islamic geometric patterns. A 12-column grid is used for desktop experiences to create clear "aisles" of content, reminiscent of a grand library.

- **Rhythm:** All spacing is derived from an 8px base unit. 
- **Margins:** Large horizontal margins (64px+) on desktop create a focused, editorial feel, pushing the content to the center of the "Sacred Path."
- **Responsive:** On mobile, margins shrink to 16px, and complex multi-column layouts reflow into a single-column scroll, prioritizing vertical reading flow.

## Elevation & Depth
Depth is achieved through **Tonal Layering** and **Luminous Glassmorphism**.

- **Surfaces:** Use semi-transparent Emerald overlays (60-80% opacity) with a 20px backdrop blur to create a sense of floating layers.
- **Borders:** Instead of heavy shadows, use 1px "Inner Light" borders in a low-opacity Gold to define the edges of containers.
- **Glows:** Active states use a "Golden Radiance"—a soft, diffused outer glow (Blur: 15px, Opacity: 0.3) that suggests the element is illuminated from within.
- **Patterns:** The lowest background layer features a subtle, 5% opacity Mashrabiya (geometric lattice) pattern that remains fixed during scroll, providing a sense of architectural permanence.

## Shapes
In accordance with the "Sacred Explorer" persona, shapes are disciplined but welcoming. We utilize **Level 2 (Rounded)** settings (8px/0.5rem base) to provide a soft, modern feel that avoids the aggressiveness of sharp corners while maintaining the structural integrity required for a library setting.

Interactive components like chips and search bars may occasionally use "Pill" shapes to contrast against the more architectural rectangular cards.

## Components
- **Buttons:** Primary buttons feature a solid Royal Green fill with a Metallic Gold border and white text. Hover states trigger a Golden Glow.
- **Cards:** Library items are housed in glassmorphic cards with a subtle 1px Gold top-border. Backgrounds feature a faint geometric watermark.
- **Inputs:** Search fields are dark and recessed, with the cursor and focus-outline using Metallic Gold to represent the "search for light."
- **Chips:** Used for categorization (e.g., "Manuscript," "Astronomy"), these should have a Royal Green stroke and high-transparency fill.
- **Progress Indicators:** Linear bars use an Emerald-to-Gold gradient to show completion or loading states.
- **Navigation:** Sidebars use heavy backdrop blurs to keep the user grounded in their current context while hinting at the library expanse behind the menu.