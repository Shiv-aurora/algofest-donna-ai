# Design System Specification: The Ethereal Scholar

## 1. Overview & Creative North Star
This design system is built upon the philosophy of **"Atmospheric Focus."** In an age of digital noise, this system acts as a sanctuary for the mind, specifically tailored for the premium student experience. We move away from the rigid, boxy constraints of traditional SaaS platforms and toward a high-end editorial aesthetic.

**The Creative North Star: The Digital Curator.** 
The UI should feel less like software and more like a pristine gallery. We achieve this through:
*   **Intentional Asymmetry:** Breaking the grid to draw focus to primary insights.
*   **Tonal Depth:** Replacing harsh lines with soft transitions of light.
*   **Breathable Layouts:** Using whitespace as a functional element to lower cognitive load, allowing the AI's intelligence to take center stage.

---

## 2. Colors & Surface Architecture
The palette is a sophisticated study in desaturated cool tones. It relies on subtle shifts in the "Mist" spectrum rather than high-contrast jolts.

### Surface Hierarchy & Nesting
To move beyond "template" UI, we use **Tonal Layering**. Instead of a flat grid, treat the layout as a series of physical layers—like stacked sheets of vellum.
*   **Base Layer:** `surface` (#F8F9FA) is your canvas.
*   **Structural Sections:** Use `surface-container-low` to define large areas (like sidebars or secondary panels).
*   **Interactive Focus:** Use `surface-container-lowest` (#FFFFFF) for the most important interactive cards or content areas to create a "lifted" feel.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section content. Boundaries must be defined solely through background color shifts or the "Ghost Border" fallback. 
*   *Instead of a border:* Place a `surface-container-lowest` card on a `surface-container-low` background. 

### The Glass & Gradient Rule
To achieve a "Pinterest" premium feel:
*   **Glassmorphism:** For floating menus or popovers, use semi-transparent `surface` colors with a `backdrop-blur` of 20px. 
*   **Signature Textures:** For primary actions, use a linear gradient from `primary` (#466270) to `primary-container` (#C9E7F7) at a 135-degree angle. This provides a "visual soul" that flat colors lack.

---

## 3. Typography
We use a dual-font system to balance editorial character with academic precision.

*   **Display & Headlines (Manrope):** Chosen for its modern, geometric elegance. Use **Light (300)** or **Regular (400)** weights even for large headings to maintain the ethereal vibe.
    *   *Goal:* Create a sense of calm authority.
*   **Body & Labels (Inter):** The workhorse for legibility. 
    *   *Goal:* Zero friction during long study sessions.

**Hierarchy as Identity:**
*   **Display-LG (3.5rem):** Use for "Welcome" states or major AI milestones.
*   **Title-SM (1rem):** Use for card headers, set in `on-surface-variant` to keep the hierarchy soft.
*   **Label-SM (0.6875rem):** Use for metadata, always with increased letter-spacing (0.05em) for a high-end "tag" look.

---

## 4. Elevation & Depth
Depth in this system is organic, not artificial.

*   **The Layering Principle:** Stacking `surface-container` tiers is the primary method of elevation. 
    *   *Lowest Tier:* `surface`
    *   *Medium Tier:* `surface-container-low`
    *   *Highest Tier (Active):* `surface-container-lowest`
*   **Ambient Shadows:** If a component must float (e.g., a modal), use an ultra-diffused shadow. 
    *   *Value:* `0px 20px 40px rgba(43, 52, 55, 0.04)`. Note the use of `on-surface` (#2B3437) at 4% opacity; never use pure black for shadows.
*   **The Ghost Border:** If accessibility requires a container edge, use the `outline-variant` token at **15% opacity**. This creates a "whisper" of a line that disappears into the background.

---

## 5. Components

### Buttons
*   **Primary:** Pill-shaped (`full` roundedness). Gradient fill (Primary to Primary-Container). Text in `on-primary`.
*   **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
*   **Tertiary:** Ghost style. `on-surface-variant` text that shifts to `primary` on hover.

### Inputs & AI Chat Bars
*   **Text Fields:** Use `surface-container-low` as the fill. On focus, transition the background to `surface-container-lowest` and apply a 1px "Ghost Border" in `primary`. 
*   **Prompt Bar:** A larger, pill-shaped container using Glassmorphism (`backdrop-blur`) to float over the conversation history.

### Cards & Lists
*   **The Divider Ban:** Never use horizontal lines (`<hr>`) to separate list items. Use **Vertical Spacing** (using the `xl` or `lg` scale) or a 2-tone background shift between items.
*   **Rounding:** Use `xl` (0.75rem) for main content cards to soften the interface.

### AI Thought-Stream (Custom Component)
For AI "thinking" states, use a soft pulse animation on a `tertiary-container` (#C2A0FC) shape. This subtle lavender accent provides the only "pop" of color, signaling the machine's "spirit" or activity.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace the "Mist":** Use `surface-dim` for inactive or disabled states to keep the palette harmonious.
*   **Use Light Weights:** Default to Light or Regular weights for Manrope to keep the "Ethereal" feel.
*   **Nesting:** Place `surface-container-lowest` elements inside `surface-container-low` areas to create natural focus.

### Don't:
*   **No High Contrast:** Avoid using `inverse-surface` (dark grey) for anything other than essential tooltips.
*   **No Hard Borders:** Never use a 100% opaque `outline` color for sectioning. It breaks the "Quiet Canvas" immersion.
*   **No Standard Grids:** Avoid perfectly symmetrical 4-column layouts. Try a 2/3 and 1/3 split to create an editorial, high-end feel.
*   **No Heavy Shadows:** If the shadow is clearly visible, it's too dark. It should be felt, not seen.