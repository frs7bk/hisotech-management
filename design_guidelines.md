# Design Guidelines: Subscription Management SPA

## Design Philosophy
Apple-inspired aesthetic with **maximum simplicity, cleanliness, and serenity**. The interface should feel spacious, calm, and effortless to navigate.

## Core Design Principles

### Visual Style
- **Minimalist & Clean**: Remove visual noise, prioritize whitespace
- **Neutral Foundation**: Subdued color palette with ONE carefully chosen accent color
- **Gentle Animations**: Smooth, subtle transitions (200-300ms) - never jarring
- **Spacious Layout**: Generous padding and margins throughout
- **Soft Shadows**: Delicate elevation effects, avoid harsh borders

### Layout System
**Spacing Scale**: Use Tailwind units of 2, 4, 8, 12, 16 for consistency
- Tight spacing: p-2, gap-2
- Standard spacing: p-4, gap-4, m-4
- Section spacing: p-8, py-12
- Large gaps: gap-16, py-16

**Structure**:
- Fixed sidebar navigation (w-64) with icon + label items
- Top bar (h-16) spanning full width with: search, notifications badge, user avatar, theme toggle
- Main content area with max-w-7xl container
- Responsive breakpoints: md: 768px, lg: 1024px, xl: 1280px

## Typography
**Arabic-First Typography**:
- Primary: 'Cairo' or 'Tajawal' from Google Fonts (excellent Arabic support)
- Weights: Regular (400), Medium (500), Semibold (600), Bold (700)
- Hierarchy:
  - Page titles: text-3xl font-bold
  - Section headers: text-2xl font-semibold
  - Card titles: text-lg font-medium
  - Body text: text-base
  - Labels/captions: text-sm
  - Helper text: text-xs text-gray-500

## Component Library

### Navigation
- **Sidebar**: Minimal icons with Arabic labels, subtle hover states, active item highlighted with accent color background
- **Top Bar**: Clean glass-morphism effect, search bar with rounded corners, notification bell with badge count

### Data Display
- **Cards**: Rounded-2xl, soft shadow, hover lift effect (translate-y-1), p-6 spacing
- **Tables**: Clean lines, alternating row colors, sticky headers, rtl-aware alignment
- **Status Badges**: Pill-shaped with appropriate colors:
  - Active/Green: bg-green-100 text-green-800 (dark: bg-green-900/30 text-green-400)
  - Warning/Orange: bg-orange-100 text-orange-800
  - Critical/Red: bg-red-100 text-red-800

### Forms
- **Input Fields**: rounded-lg, border-2, focus ring with accent color, p-3
- **Buttons**: 
  - Primary: accent color, rounded-lg, px-6 py-3, medium weight
  - Secondary: transparent with border, same dimensions
  - Ghost: no background, hover accent color
- **Selects/Dropdowns**: Match input styling, chevron icon

### Charts & Analytics
- **Recharts Integration**: Use subtle gradients, rounded corners on bars, minimal gridlines
- **Color Palette for Data**: Complementary shades of accent color
- **Tooltips**: Soft shadow, rounded corners, clear typography

### Smart Assistant Interface
- **Chat Bubble Design**: Rounded messages alternating sides (user vs AI)
- **Voice Input**: Pulsing microphone button with accent color
- **Action Preview Cards**: Before executing critical operations, show elegant confirmation modal with details
- **Thinking State**: Subtle loading animation

### Notifications
- **Toast Style**: Top-right positioning, slide-in animation, auto-dismiss
- **Panel**: Dropdown from notification bell, grouped by date, unread indicator
- **Colors**: Info (blue), Success (green), Warning (orange), Error (red)

## RTL Support
- All layouts must flip horizontally
- Text alignment: right-to-left
- Icons: mirror horizontally where directional
- Margins/padding: ml becomes mr, pl becomes pr, etc.

## Responsive Behavior
- **Mobile (< 768px)**: Sidebar becomes bottom navigation or hamburger menu, single column layouts, full-width cards
- **Tablet (768-1024px)**: Collapsible sidebar, 2-column grids
- **Desktop (> 1024px)**: Full sidebar visible, 3-4 column grids, side-by-side panels

## Images
**Dashboard Hero/Header**: Optional decorative abstract gradient (not a photo) in header area if space allows - keep it subtle
**Product Cards**: Placeholder for product icon/logo (100x100px) in card top-left
**No large hero images** - this is a dashboard application, not a marketing site

## Dark Mode
Seamless theme toggle with smooth color transitions:
- Light: white backgrounds, gray-50 for surfaces, gray-900 text
- Dark: gray-900 backgrounds, gray-800 for surfaces, gray-100 text
- Accent color: same in both modes
- Charts: adjust opacity for dark mode readability

## Animation Guidelines
**Use sparingly**:
- Page transitions: fade + slight slide (100ms)
- Modal overlays: scale from 0.95 to 1.0
- Card hovers: subtle lift (2-4px)
- Loading states: gentle pulse or spinner
- **No** excessive parallax, scroll-triggered animations, or decorative motion

## Color Coding System
**Subscription Status** (throughout the app):
- Active: Green shades
- Expiring Soon: Orange/Amber shades
- Expired: Red shades

**Financial Indicators**:
- Revenue/Profit: Green
- Expenses: Red
- Neutral/Balance: Blue or accent color