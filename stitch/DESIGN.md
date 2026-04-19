# Design System: High-End Editorial Korean Linguistics

## 1. Overview & Creative North Star
**Creative North Star: "The Typographic Monolith"**

This design system moves away from the "educational app" archetype and moves toward a high-end, editorial experience inspired by luxury real estate and premium architectural journals. By leaning into a strict achromatic palette, we transform the learning process into a sophisticated ritual.

The interface breaks the traditional grid through **Intentional Asymmetry**. We utilize a unique vertical navigation axis that anchors the left side of the screen, creating a permanent structural pillar. Content is then allowed to breathe with generous white space, using extreme typographic scale shifts to create a sense of hierarchy that feels curated rather than computer-generated.

---

## 2. Colors & Tonal Depth
We employ a high-contrast, black-and-white foundation. Color is not used for decoration; it is used for state and structural importance.

### The "No-Line" Rule
Sectioning must be achieved through background shifts, not borders. 1px solid lines for dividers are strictly prohibited. Boundaries are defined by placing a `surface-container-low` section against a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as physical layers. Depth is created by "stacking" tones:
- **Base Layer:** `surface` (#f9f9f9)
- **Secondary Sectioning:** `surface-container-low` (#f3f3f4)
- **Floating Cards:** `surface-container-lowest` (#ffffff)
- **Interactive Elements:** `primary` (#000000)

### Glass & Texture
For floating modals or sticky navigation headers, use **Glassmorphism**: 
- Color: `surface` at 80% opacity.
- Effect: 20px Backdrop Blur.
- Use subtle gradients transitioning from `primary` to `primary-container` for main action buttons to provide a "sheen" that flat black cannot achieve.

---

## 3. Typography
The system relies on **Plus Jakarta Sans**, a typeface that balances geometric precision with modern warmth.

- **Display-LG (3.5rem):** Reserved for hero progress stats or major linguistic breakthroughs.
- **Headline-LG (2rem):** Used for primary page titles. Bold weight is mandatory.
- **Title-MD (1.125rem):** Used for grammar point headers within cards.
- **Body-MD (0.875rem):** Used for descriptive text and formal definitions.
- **Label-MD (0.75rem):** Used for the signature rotated vertical navigation.

**Editorial Hierarchy:** We use "Scale Shock"—placing small label-sm text directly adjacent to headline-lg text—to create an authoritative, premium feel.

---

## 4. Elevation & Depth
We eschew the standard "material" shadow in favor of **Tonal Layering** and **Ambient Light**.

- **The Layering Principle:** A card using `surface-container-lowest` placed on a `surface` background creates a natural, soft lift. This is our primary method of elevation.
- **Ambient Shadows:** When a card requires a "floating" state (e.g., a high-priority lesson card), use:
  - `box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);`
- **The "Ghost Border" Fallback:** If a container lacks sufficient contrast against its background, use a 1px border of `outline-variant` at 20% opacity. Never use a 100% opaque border.
- **Thick Stroke Indicators:** Progress rings and bars must use a minimum 8px stroke weight. This provides a tactile, "architectural" weight to the progress tracking.

---

## 5. Components

### Vertical Navigation Axis
The signature component. Fixed to the left viewport. Text is rotated -90 degrees.
- **Active State:** `primary` (#000000) with a 4px thick vertical bar.
- **Inactive State:** `on_surface_variant` (#474747).

### Editorial Cards
Cards use `roundedness-lg` (1rem). No dividers allowed inside cards.
- **Header:** Title-MD.
- **Content Separation:** Use 24px vertical white space.
- **Imagery:** Cards should feature high-end photography or minimalist Hanok-inspired illustrations.

### Buttons
- **Primary:** `primary` background, `on_primary` text. Rectangular with `roundedness-md`.
- **Secondary:** Transparent background with a `primary` 2px stroke.
- **Lesson Button:** High-contrast black button with a subtle gradient to `primary_container`.

### Progress Indicators
- **Circular (Dashboard):** 12px stroke weight. Track color: `surface_container_highest`. Progress color: `primary`.
- **Linear (Lesson):** 8px stroke weight. Minimalist, no rounded end-caps (butt caps only) to maintain the modern real estate aesthetic.

---

## 6. Do's and Don'ts

### Do
- **DO** use the vertical navigation to create a unique "L-shape" layout flow.
- **DO** allow for extreme white space. If a section feels "empty," it is likely working correctly.
- **DO** use the `roundedness-lg` for all major containers to soften the high-contrast palette.
- **DO** ensure Korean characters are rendered with the same weight as the English text to maintain visual balance.

### Don't
- **DON'T** use grey borders to separate list items; use 16px or 24px of vertical spacing instead.
- **DON'T** introduce accent colors (blues, greens, yellows). The only non-monochrome color allowed is `error` (#ba1a1a) for incorrect grammar entries.
- **DON'T** use standard drop shadows with high opacity. They look "cheap" and break the editorial feel.
- **DON'T** center-align text in cards. Stick to strong left-aligned typography to maintain the architectural grid.