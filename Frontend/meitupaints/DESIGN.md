# Meitu Paints UI Design System

This document records the current design direction for the Meitu Paints Nepal web platform. It is based on the Apple-style reference provided during the redesign work and the practical decisions made while redesigning the public pages, product pages, color studio, rate calculator, dealership flow, horoscope pages, and operational dashboards.

The preferred interface is premium, minimal, light, calm, and precise. It should feel like a modern Apple product page combined with a professional internal operations tool where needed.

## Current UI Preference

The current preferred UI is:

- Apple-like, not generic corporate.
- Premium and minimal, not decorative for its own sake.
- Light canvas first, with product color and paint texture as the main visual energy.
- Large, confident typography with compact supporting text.
- Smooth, subtle motion instead of flashy animation.
- White and fog surfaces with no heavy shadows.
- Rounded but controlled geometry.
- Simple icons used for clarity, not decoration.
- Functional pages should be utility-first, not overdesigned.
- Public pages can use more visual energy, gradients, product imagery, and animated graphics.
- Operational pages should be fast, compact, and non-verbose.

The design should make Meitu feel like a premium paint and construction materials company, not a cluttered paint catalog.

## Core Design Principle

Use a gallery-white Apple-style surface system:

- The page canvas is soft off-white.
- Cards and content wells are pure white.
- Elevation is created through color contrast, radius, spacing, and hierarchy.
- Avoid heavy shadows.
- Use product images, paint colors, texture visuals, and gradients as the emotional layer.
- UI chrome should remain restrained.

The interface should feel calm at first glance, then rich when the user interacts with it.

## Visual Personality

Preferred references:

- Apple product pages
- Apple account/login UI
- Shopify Admin for operational clarity
- Linear for clean hierarchy
- Gmail-style compact workflow lists
- Premium architectural product catalogs

Avoid:

- Bootstrap-like generic cards
- Dark admin dashboards
- Heavy red branding everywhere
- Large empty whitespace that does not serve layout
- Overly verbose text blocks
- Big charts unless absolutely useful
- Harsh gradients with hard edges
- Random decorative blobs
- Heavy box shadows
- Nested card clutter

## Color System

### Primary Tokens

```css
:root {
  --color-ink: #1d1d1f;
  --color-graphite: #707070;
  --color-slate: #474747;
  --color-ash: #333333;
  --color-fog: #f5f5f7;
  --color-snow: #ffffff;
  --color-obsidian: #000000;
  --color-silver-mist: #e8e8ed;
  --color-azure: #0071e3;
  --color-cobalt-link: #0066cc;
  --color-caution: #b64400;
}
```

### Roles

- `#f5f5f7` is the main page background.
- `#ffffff` is the primary card and panel surface.
- `#1d1d1f` is the main text and icon color.
- `#707070` is secondary copy, captions, and metadata.
- `#0071e3` is the primary action color.
- `#0066cc` is the inline link color.
- Black is used only for high-contrast final CTA sections or dark product stages.

### Rules

- Blue should be rare. Use it for primary actions and important navigation links.
- Do not use Meitu red as the dominant UI color in the Apple refresh. Red can appear in the logo and very controlled brand moments.
- Product color, shade swatches, paint buckets, room previews, and texture graphics should provide most of the chromatic richness.
- Gradients should be soft, blended, and premium. Hard gradient borders should be avoided.
- Color cards and shade cards should show honest color. Do not add white overlays when exact color inspection matters.

## Typography

### Font Family

Use Apple-like system typography:

```css
--font-sf-pro-display: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
--font-sf-pro-text: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
```

### Type Personality

- Headlines should feel large, dense, and confident.
- Body copy should be light, calm, and readable.
- Use negative letter spacing for large text.
- Use short headings and compact copy.
- Do not center long paragraphs.
- Avoid verbose page sections, especially on utility pages.

### Scale

Use these as practical targets:

- Navigation: 12px to 14px
- Caption/meta: 12px
- Body small: 14px
- Body: 17px
- Subheading: 20px to 24px
- Section heading: 40px to 64px
- Hero heading: 72px to 104px on desktop
- Mobile hero heading: 44px to 70px

### Heading Style

Hero headings:

```css
font-family: var(--font-sf-pro-display);
font-weight: 700;
line-height: 0.98 to 1.05;
letter-spacing: -0.04em to -0.065em;
```

Supporting copy:

```css
font-family: var(--font-sf-pro-text);
font-weight: 300 or 400;
line-height: 1.35 to 1.5;
color: var(--color-graphite);
```

## Layout System

### Page Width

- Public content max width: `1200px`.
- Full-bleed hero sections can span the viewport.
- Cards and grids should usually live inside a centered `1200px` content rail.
- Avoid arbitrary narrow containers unless the content is form-based.

### Spacing

Preferred spacing:

- Page horizontal margin: `20px` to `40px`.
- Card padding: `18px` to `28px`.
- Large section top/bottom spacing: `54px` to `92px`.
- Avoid large top padding under navbar unless a hero needs breathing room.
- If a page feels like it has blank space above useful content, tighten it.

### Radius

- Feature cards: `28px`.
- Large panels: `32px` to `36px`.
- Buttons and pills: `999px`.
- Small controls: `16px` to `20px`.

### Shadows

Default rule: no heavy shadows.

Use:

- Borders: `1px solid rgba(232,232,237,.9)`
- Background contrast
- Frosted surfaces
- Inner highlight only when useful

Avoid:

- Large dark drop shadows
- Floating dashboard cards everywhere
- Shadow-based elevation systems

## Navigation

The navbar should feel close to Apple navigation:

- Compact height.
- Centered nav links on desktop.
- Logo only, no repeated "MEITU PAINTS" text in the nav.
- Search is an icon, not an always-visible input.
- Bag/account icon replaces a text login button.
- Product navigation is expanded into: `Buckets`, `Colors`, `Textures`.
- `Rate Calculator`, `Horoscope`, `Dealership`, `About Us`, and `Support` should be visible when space allows.

### Navbar Search

Preferred behavior:

- Clicking search opens a smooth extension below the navbar.
- Page content behind the search can blur or dim subtly.
- Search results should use right-arrow icons.
- The search overlay should appear above all page content.
- On mobile, the search extension should cover the page below the navbar and animate from the navbar bottom.

### Account Menu

Preferred behavior:

- The bag icon opens an Apple-like account extension.
- Menu options depend on role.
- Admin, Dealer, Factory, and Dispatcher should see role-appropriate options.
- On mobile, account/search/menu overlays replace the navbar contents with a close button at top right.

### Mobile Navbar

Preferred behavior:

- Hamburger is far right.
- Bag and search icons sit to its left.
- Icons are spaced cleanly.
- When any mobile panel opens, navbar content should simplify and show an `X` close button.
- Panel animation starts from the bottom of the navbar.
- No gap between navbar and panel.
- Mobile panel should have the highest z-index and not hide behind page content.

## Buttons

### Primary CTA

Use Apple blue:

```css
background: #0071e3;
color: #fff;
border-radius: 999px;
padding: 8px 16px;
font-size: 17px;
font-weight: 400;
```

### Text Link CTA

Use inline link style:

```css
color: #0066cc;
background: transparent;
border: 0;
padding: 0;
```

Include a small right arrow when navigation is involved.

### Hover Behavior

- Primary buttons can shift slightly upward.
- Text links can reveal a subtle underline.
- Avoid big color changes.
- Avoid multiple heavy pill buttons side by side unless necessary.

## Icons

Use clean, minimal, monochrome SVG line icons.

Rules:

- Stroke width should be consistent.
- Icons are usually `17px` to `22px`.
- Icons should explain function.
- No emoji icons.
- No random mixed icon styles.

Common icon meanings:

- Search: magnifying glass
- Account: bag
- Products: package/store
- Colors: palette
- Textures: wave/texture
- Calculator: calculator
- Support: headset
- Dealership: store
- Delivery: truck
- Safety/trust: shield
- Continue: right arrow

## Motion

Preferred motion:

- Subtle fade-up on section entry.
- Smooth navbar extensions.
- Calm floating visual elements in hero graphics.
- No scroll-jacking.
- No animations that interfere with page scrolling.
- Respect `prefers-reduced-motion`.

Timing:

- Fast UI feedback: `0.1s` to `0.16s`
- Section reveal: `0.34s` to `0.72s`
- Ambient floating visuals: `7s` to `24s`

Avoid:

- Janky parallax
- Tilted images that hinder scroll
- Animations that block touch or wheel scrolling
- Repeated flashy effects

## Imagery and Graphics

Preferred:

- Large product imagery used clearly.
- Real paint bucket/product assets where useful.
- Room previews for colors.
- Texture graphics to show Meitu's texture paint capability.
- SVG graphics only when they clarify an abstract system.
- Premium colorful graphics on the home page, but still minimal.

Avoid:

- Naming images visibly in hero art.
- Product visuals that feel like random stock images.
- Cropped room previews on mobile when color inspection matters.
- White overlays over color swatches when exact color matters.

## Forms and Inputs

Inputs should feel like Apple account forms:

- Clean, rounded, minimal.
- No harsh blue browser selection highlight.
- Focus ring should be outer, soft, and intentional.
- Autofill styling should be neutralized where possible.
- Labels should be concise.
- Optional fields can be hidden behind add buttons.
- Forms should load with a clear smooth animation.

### Login Page

Preferred:

- Minimal Apple-style sign-in.
- Navbar visible.
- Email/password fields combined or visually grouped.
- Eye icon for password.
- Submit arrow icon.
- No ugly blue internal highlight.

### Dealership Registration

Core fields visible first.

Optional fields hidden by default:

- Business Type
- PAN / VAT
- Business Address
- Years in Business
- Monthly Order Estimate
- Preferred Territory / Area
- Notes

Each optional field should be addable with a sleek minimal control.

## Sticky Side Panels

The project uses sticky behavior in multiple places.

Preferred behavior:

- Left or right preview panel stays fixed while the matching catalog scrolls.
- Sticky panel is constrained by the top and bottom of its parent catalog section.
- It must not overlap unrelated content above or below.
- On mobile, sticky panels become foreground overlays below the navbar with a close button.

Examples:

- Product detail image stays sticky while right-side content scrolls.
- Color room preview stays sticky while color catalog scrolls.
- Rate calculator right estimate panel stays sticky while product catalog scrolls.

CSS principle:

```css
.sticky-panel {
  position: sticky;
  top: 44px;
  align-self: start;
}
```

Important:

- Parent containers must not use `overflow: hidden` in a way that breaks sticky behavior.
- If horizontal clipping is needed, prefer `overflow-x: clip` on root level, not on the sticky parent.

## Public Page Guidelines

### Home Page

Preferred:

- Full-width premium hero.
- Apple-like large headline.
- Colorful but restrained graphics.
- Texture references that show Meitu's excellence in texture paints.
- Smooth animation.
- No unnecessary blank top space.
- Carousel/hero imagery must not interfere with scrolling.
- On mobile, hero images can be hidden if they reduce clarity, but the gradient background should remain.

### Products Page

Preferred:

- Premium Apple-like product category experience.
- Large but useful category cards.
- Soft gradients with blended edges.
- Product card CTA should be text link style, not a wrapped pill.
- "View Collection" should have a right blue arrow and animated underline on hover.
- In the "All products" view, do not show "Login to Order" on every product card.

### Product Category Pages

Preferred:

- No unnecessary top padding.
- Hero height should be compact.
- Cards should be clean and image-first.
- Back behavior should not trap users between category and detail pages.

### Product Detail Pages

Preferred:

- Left image container has a fixed size and does not change based on image loading.
- Loaded images should feel instant on revisit through browser cache and app image cache where implemented.
- Left product image should remain sticky while right content scrolls.
- Product name and key info align to the top of the image.
- CTA/system metadata aligns visually with the lower part of the image.
- Long descriptions should sit below the fold on the right side.
- Once description ends, the sticky image should naturally scroll with the rest of the page.

### Colors Page

Preferred:

- Premium color studio, not a cluttered catalog.
- Upper intro section should be aesthetic but concise.
- Search bar should be premium and clean.
- If a color is selected:
  - Catalog changes from 7 colors per row to 4 colors per row on desktop.
  - Room preview appears on the right.
  - Room preview uses sticky behavior within catalog boundaries.
  - Room preview is polished and Apple-grade.
  - Selected color highlight should be professional, not a black outline.
- On mobile:
  - Room preview comes forward as an overlay under the navbar.
  - It can be closed with an exit button.
  - Room image should show fully, not zoom/crop too much.

### Textures Page

Preferred:

- Premium Apple-like page.
- Use texture graphics and icons.
- Right-side graphic should be sleek, not bulky.
- Page should feel connected to Meitu's texture paint expertise.

### Rate Calculator

Preferred:

- Product catalog on the left.
- Estimate/system panel on the right.
- Right panel uses sticky behavior.
- Category filters scroll with the catalog, not sticky.
- System cards should be equal size regardless of text length.
- System cards should be compact and two-column where possible.
- Total price area should be clear and not clipped.
- Add step guide:
  - Add area
  - Select product
  - Select system
- Area input should not accept negative values.
- Area input should use Apple-like increment/decrement controls.
- Avoid unnecessary top padding.

### Dealership Page

Preferred:

- Premium Apple-like hero.
- Clear value proposition.
- Simple top steps:
  - Apply
  - Review
  - Activate
- Visual should communicate dealer portal, catalog, orders, and support.
- Use icons for product systems, color support, pricing, service, trust, and delivery.
- Keep copy concise.
- CTA should be clear: apply for dealership.

### Dealership Registration Page

Preferred:

- Utility-based Apple-like form.
- Form first.
- Optional details hidden and addable.
- Loading animation.
- Apple-like back arrow to dealership.
- No harsh blue input highlight.

### Inquiry Page

Preferred:

- Utility first.
- Form should be at the top.
- Loading/reveal animation.
- "Before submitting" guidance should not be visible in first viewport.
- Back button should be simple and Apple-like.
- Avoid overdesign.

### Horoscope Page

Preferred:

- Premium Apple-like, but not too much functional clutter.
- Do not show search/filter controls if not needed.
- Grid cards should not show zodiac descriptions.
- Cards should show sign, image, palette swatches, chips, and a simple view action.
- Detail pages should use solid color cards without white overlays.
- Back link should return cleanly to horoscope, not trap user in browser history loops.

## Dashboard and Operational UI

The Admin, Dispatcher, Dealer, and Factory areas should not look like the public marketing pages.

Preferred:

- Same Meitu operations design language.
- Light, compact, professional.
- Fixed dashboard shell where needed.
- Sidebar with clean SVG icons.
- Dense but readable rows/tables.
- Drawer interactions instead of heavy modals where suitable.
- Minimal cards.
- No excessive charts.
- No bloated metric walls.
- Fast workflow-first design.

### Factory Dashboard

Factory is operational, not analytical.

Preferred:

- Orders like an inbox.
- Stock list like a clean inventory table/grid.
- Quick stock changes with `+1`, `+5`, `+10`, and exact edit.
- Stock edit requires reason and confirmation.
- Stock history table is clean and searchable.
- Invoice/proforma actions are consistent with Admin.
- Driver details should appear in proforma invoices.
- Only required buttons should appear at the current order stage.
- Avoid empty cascading dropdowns.
- Keep order detail non-verbose, with stock reservation and items at the top.

### Admin Dashboard

Preferred:

- Clean list/grid toggles where useful.
- Dealer list should not show meaningless `NPR 0, 0 orders` if data is unavailable.
- Dealer profile should be concise and show credentials clearly when available.
- Use icons to reduce text burden.
- Simplify verbose pages without removing features.

### Dealer Dashboard

Preferred (in addition to the general Dashboard rules above):

- Same token system as every other dashboard — `--color-fog` canvas, `--color-snow` cards, `--color-azure` as the sole accent, 28px card radius, zero box-shadow. No page-specific palette or typeface.
- The Catalog page in particular should feel roomier than the ultra-dense Admin tables: larger product imagery, more generous grid and card padding, a confident page heading — this is the page a dealer spends the most time in, so it earns more breathing room than a settings table, without becoming a marketing page (no hero, no gradients, no scroll storytelling).
- Pack size (the largest pack in a product family) is the primary scan target for a wholesale buyer — give it clear typographic weight, but as a normal bold Inter/SF Pro figure within the existing type scale, not a separate display face or decorative device.

## Data and Performance UX

The user experience should feel instant:

- Use RTK Query/server-state cache for products, orders, dealers, stock, colors, and reused entities.
- Show cached data immediately.
- Use subtle background updating indicators.
- Avoid full page loading skeletons if cached data exists.
- Images should not resize containers after load.
- Product and color image caches are acceptable for smoother revisits.

## Accessibility and Responsiveness

Required:

- Mobile layouts must work cleanly.
- No horizontal overflow.
- Tap targets must be thumb-friendly.
- Sticky desktop panels become overlays on small screens where appropriate.
- Icons need labels or context.
- Forms need proper labels.
- Avoid scroll-blocking animation.
- Respect reduced motion.

## Do

- Use `#f5f5f7` canvas and `#ffffff` card surfaces.
- Use large display typography on public pages.
- Use compact text and functional hierarchy on utility pages.
- Use blue only for meaningful actions.
- Use clean SVG icons.
- Use soft blended gradients.
- Keep cards light and border-based.
- Tighten meaningless blank spaces.
- Use sticky panels where they genuinely improve workflows.
- Make mobile overlays clear and dismissible.

## Don't

- Do not add heavy card shadows.
- Do not overuse red in the redesigned UI.
- Do not show unnecessary filters or search bars.
- Do not add verbose descriptions in compact card grids.
- Do not crop room previews aggressively on mobile.
- Do not add top padding that makes pages feel delayed.
- Do not place huge containers around simple controls.
- Do not use black outlines for selected color cards.
- Do not use harsh gradient edges.
- Do not make operational dashboards look like marketing pages.

## Implementation Notes

Current project locations:

- Global CSS and broad design tokens: `src/index.css`
- Public navbar: `src/components/NavBar.jsx`
- Shared Apple-like icons: `src/components/ui/ApplePageIcons.jsx`
- Product image/cache behavior: `src/redux/imageCacheSlice.js`
- Color cache behavior: `src/redux/colorsCacheSlice.js`
- RTK Query data layer: `src/redux/api`

When adding new pages, prefer:

1. `NavBar`
2. A full-width or centered hero
3. A concise heading stack
4. One clear primary CTA
5. A small set of practical content cards
6. Clean SVG icons
7. Subtle reveal animation
8. Responsive mobile behavior

When modifying existing pages, preserve workflow behavior first, then improve visual hierarchy.

## Current Design Summary

The current Meitu Paints UI preference is a premium Apple-like design system with a soft fog canvas, white rounded surfaces, large display typography, restrained blue CTAs, clean SVG icons, polished gradients, and minimal copy. Public pages should feel immersive and beautiful. Utility pages should feel fast and practical. Operational dashboards should feel compact, professional, and workflow-driven.

The most important rule: make the product, color, texture, order, or task the center of attention. UI chrome should support the work, not compete with it.
