# Amazon Custom Theme Design System

## Global Appearance
- **Color Mode**: Light Mode
- **Background**: Page backgrounds should use a very light gray (`#f3f4f6` / `bg-gray-100`) to make the white component cards pop.
- **Roundness**: Small to medium border-radius (`rounded-sm` or `ROUND_FOUR`) for cards and buttons.

## Color Palette
- **Primary / Brand Color (Headers, Footers)**: Navy Blue (`#232F3E`). This is the dominant dark color used for the top navigation bar and sub-navigation bar.
- **Secondary / Action Color (Buttons, Badges, Links)**: Amazon Orange / Yellow (`#FBBF24` / `bg-yellow-400`).
- **Interactive States**: Buttons should have a gradient effect when possible (e.g., `from-yellow-200 to-yellow-400`) and a subtle border (`border-yellow-300`). Hover states should darken slightly (`bg-yellow-500`).
- **Text Colors**:
  - On Primary (Navy): White (`#FFFFFF`).
  - On Background (Light Gray): Dark Charcoal / Black.
  - Secondary Text / Subtitles: Gray (`text-gray-500` / `text-gray-400`).
- **Alert / Accent Colors**: Green (`#10B981`) for positive actions (like "Green Credits Wallet"), Red for high-risk warnings.

## Typography
- **Font Family**: Inter (or clean sans-serif equivalent).
- **Headings**: Semi-bold to bold.
- **Body Text**: Standard size, easily readable.
- **Small Text**: `text-xs` is heavily used for metadata, categories, and small utility links.

## Component Styling Rules
1. **Cards & Containers**:
   - Background: Pure White (`#FFFFFF`).
   - Padding: Generous padding (e.g., `p-6` to `p-10`).
   - Borders/Shadows: Use subtle drop shadows (`shadow-md`) by default. On hover, elevate the card (`hover:shadow-lg`). No thick borders.
2. **Buttons**:
   - Padding: `p-2`.
   - Typography: `text-sm` or `text-xs`.
   - Style: Gradient yellow background, slight rounded corners (`rounded-sm`), subtle yellow border.
3. **Data Tables & Lists**:
   - Clean dividers (thin light gray lines).
   - Use small thumbnail images (`object-contain`).
4. **Header / Navigation**:
   - Top Header: Solid `#232F3E`, flexbox layout, items centered.
   - Sub-header: Slightly lighter shade of `#232F3E`, horizontal list of links.
   - Links should have a `hover:underline` effect.

## Specific UI Elements for REVIVE
- **Health Card**: Needs to look verifiable and secure. Use a clean white card with an authoritative badge (perhaps green or gold) for the AI Grade. Include an area for small square defect photos.
- **Green Credits Wallet**: Needs to feel rewarding. Prominently feature the leaf icon and a toggle switch. Use the `text-green-600` color for the balance to emphasize environmental positivity.
- **Ops Dashboard**: Needs to feel like a high-density internal tool. Maximize screen real estate. Use a large dashed-border dropzone for the "Bulk Grade" area.
