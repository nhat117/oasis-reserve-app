

# Dashboard Premium Polish Plan

## Overview
Refine the existing admin dashboard (`BookingStats.tsx` + header/tabs in `AdminDashboard.tsx`) to achieve a Fresha-level premium aesthetic. No structural changes — only visual elevation.

## Changes

### 1. BookingStats.tsx — KPI Cards & Chart Polish

**KPI Cards (Revenue, Bookings, Value)**
- Extract the 3 inline stats into standalone cards with individual borders, soft shadows, and more padding
- Make numbers larger (`text-3xl font-semibold`) with serif font for the figures
- Add trend indicator arrows (TrendingUp/TrendingDown icons with muted green/red + percentage text)
- Add soft icon accent in each card (DollarSign, CalendarCheck, TrendingUp) with `bg-primary/5` circular background
- Increase card padding to `p-5`

**Chart Section**
- Add rounded bar radius `[6,6,0,0]`
- Use softer grid lines (`stroke-muted/40`, `strokeDasharray: "4 4"`)
- Add subtle gradient fill on bars via `<defs><linearGradient>`
- Improve tooltip with rounded corners, subtle shadow, no harsh border
- Add a small trend summary line above the chart ("Revenue up 12% vs last period")

**Upcoming Appointments**
- Better visual hierarchy: time as bold anchor on left, client name prominent, service as muted subtext
- Use soft `border-b border-border/50` separators instead of bg-muted blocks
- Add subtle left accent bar on each row (`border-l-2 border-primary/30`)
- Status badges with softer styling (muted backgrounds, no heavy borders)

**Activity Timeline**
- Convert to vertical timeline with a thin left line (`border-l`) and dot markers
- Emphasize date as a pill-style label
- Use soft tag badges (Booked = muted green bg, Completed = muted primary bg, Cancelled = muted red bg)

**Today's Appointments**
- Time as the visual anchor on left in a styled pill
- Better hierarchy: name > service > therapist
- Subtle hover lift effect

**Top Services**
- Add horizontal progress bars (relative to max count) with `bg-primary/20` track and `bg-primary` fill
- Show change indicator vs last month (arrow + count)
- Remove harsh grid layout, use stacked rows

**Top Team Members**
- Replace number circles with initial-based avatars (`bg-primary/10` with first letter)
- Highlight #1 performer with a subtle crown icon or gold accent ring
- Add a thin progress bar showing relative revenue share

### 2. AdminDashboard.tsx — Header & Tab Navigation

**Header**
- Increase header height slightly, add more vertical padding
- Use the brand logo instead of Leaf icon
- Refine logout button styling (ghost, smaller, more subtle)

**Desktop Tabs**
- Replace default TabsList with a custom pill-style or underline-style nav
- Active state: soft pill background with `bg-primary/10 text-primary` or underline
- Increase spacing between tab items
- Remove icons from tab labels for cleaner look (keep text only)

**Mobile Bottom Nav**
- Increase icon size slightly and add active indicator dot below active icon
- Use `bg-card/95 backdrop-blur-sm` for frosted glass effect
- Better padding and safe area handling

### 3. index.css — Micro-interactions & Global Polish

- Add transition utilities for card hover effects:
  ```css
  .card-hover { transition: transform 200ms ease, box-shadow 200ms ease; }
  .card-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
  ```
- Ensure all Card components use `shadow-sm` baseline with `hover:shadow-md` transition

### Technical Approach
- All changes in `src/components/BookingStats.tsx`, `src/pages/AdminDashboard.tsx`, and `src/index.css`
- No new components or dependencies needed
- Uses existing Recharts, Lucide icons, and Tailwind classes
- Maintains all existing data logic and queries untouched

