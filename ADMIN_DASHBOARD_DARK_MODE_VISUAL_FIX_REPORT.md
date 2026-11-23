# PARTH MOBILE CARE — DARK MODE COLOR & SURFACE CORRECTION REPORT

**Date:** November 5, 2026  
**Project:** Parth Mobile Care Admin Web Dashboard (`admin-dashboard/`)  
**Target Environment:** Local Admin Web Portal (`http://localhost:3000`)  
**Production Firebase Project ID:** `parthmobilecare-a474d` (Strictly Unchanged)  
**Primary Brand Anchor:** `#194D9C` (`PALETTE.primary` in `src/theme/colors.ts`)  
**Build & Test Verification:** `npm run build` Clean (2.18s, 0 errors) • Vitest 11/11 Passed • Mobile App Jest 300/300 Passed  

---

## 1. Executive Summary

A targeted, systematic Dark Mode visual correction has been performed across the entire Parth Mobile Care Admin Web Dashboard. 

All grey, washed-out, or stark white surfaces inside Dark Mode have been eliminated and replaced with a cohesive, multi-tiered dark navy and brand-blue hierarchy based on the requested design tokens.

### Key Corrections Completed:
1. **Appearance & Theme — Selected Dark Mode Card (Profile & Security):**  
   Replaced the unstyled grey surface with subtle dark navy surface `#142D50`, framed with exact brand blue `#194D9C` border and glowing accent ring (`ring-2 ring-[#194D9C]/25`). Elevated the moon icon box to `#194D9C` with white icon and shadow. Brightened the title to `#E8EEF8`, muted the description to `#94A3B8`, and styled the radio indicator with `#194D9C` border and dot.
2. **Total Acquired Devices Card (Dashboard Overview):**  
   Replaced the pale grey/lavender background with subtle brand surface `#142D50` and subtle blue border `#194D9C/60`. Upgraded the title to `#E8EEF8`, supporting text to `#93C5FD`, and introduced a dedicated brand-blue icon container (`bg-[#194D9C]` with white smartphone icon), matching the adjacent Second-Hand Operations stock cards.
3. **KPI Cards (Active Staff Members, Today's Attendance, Leads, Gross Profit):**  
   Fixed the first KPI card icon container (Active Staff Members) by replacing the falling-back custom shade with explicit, bulletproof subtle brand surface `#142D50` (`border-[#194D9C]/60 text-blue-300`). Enforced dark card backgrounds `#0F192C` and hairline navy borders `#24344D` across all StatCards.
4. **Global Base & Theme Infrastructure:**  
   Replaced default Tailwind `slate-950` (`#020617` near-black) with the exact requested deep navy `#070D1B` for the page background. Centralized the design tokens in `tailwind.config.js` and `src/styles/index.css`.
5. **Shared Components & All 12 Pages:**  
   Standardized `Card`, `StatCard`, `Button`, `Input`, `Select`, `ExportDropdown`, `Modal`, `TablePagination`, `EmptyState`, and all 12 page views with consistent dark navy surfaces.

---

## 2. Established Dark Mode Design Tokens

The following design tokens are registered as first-class utilities in `tailwind.config.js` and CSS variables in `src/styles/index.css`:

| Token Name | Hex Code | Role in Interface | Applied Classes |
|:---|:---|:---|:---|
| **Main Background** | `#070D1B` | Global dashboard background canvas | `html.dark body`, `dark:bg-[#070D1B]` |
| **Sidebar Background** | `#0D1729` | Fixed navigation rail & sub-navigation | `dark:bg-[#0D1729]` |
| **Header Background** | `#0D1729` | Sticky top app bar (with blur) | `dark:bg-[#0D1729]/95` |
| **Standard Card Background** | `#0F192C` | Base card containers, stat cards, tables | `dark:bg-[#0F192C]` |
| **Elevated Card Background** | `#17243A` | Modals, dropdown menus, nested boxes | `dark:bg-[#17243A]` |
| **Hover Background** | `#1C2A42` | Interactive element hover states | `dark:hover:bg-[#1C2A42]` |
| **Primary Brand Blue** | `#194D9C` | Primary buttons, active nav, focus rings | `bg-brand-500`, `border-[#194D9C]` |
| **Subtle Brand Surface** | `#142D50` | Selected theme cards, blue KPI icons, feature banners | `dark:bg-[#142D50]` |
| **Primary Text** | `#E8EEF8` | Main headings, card titles, input text | `dark:text-[#E8EEF8]` |
| **Secondary Text** | `#94A3B8` | Subtitles, labels, descriptions, inactive icons | `dark:text-[#94A3B8]` |
| **Muted Text** | `#71839D` | Placeholders, timestamps, borders, hints | `dark:text-[#71839D]` |
| **Standard Border** | `#24344D` | Hairline card borders, table dividers, input borders | `dark:border-[#24344D]` |
| **Selected Border** | `#194D9C` | Active cards, selected tabs, focus states | `dark:border-[#194D9C]` |
| **Success Accent** | `#10B981` | Positive trends, present attendance, active pills | `text-emerald-500`, `dark:bg-emerald-950/80` |
| **Warning Accent** | `#F59E0B` | Pending approvals, late attendance | `text-amber-500`, `dark:bg-amber-950/80` |
| **Danger Accent** | `#EF4444` | Deactivated accounts, rejection alerts | `text-rose-500`, `dark:bg-rose-950/80` |

---

## 3. Detailed Component & Surface Audit

### A. Appearance & Theme — Selected Dark Mode Card (`ProfilePage.tsx`)
- **Before:** Unstyled grey background (`bg-slate-800`), washed out text, grey icon container, weak contrast with the dark background.
- **After:**
  - Selected Card Background: `dark:bg-[#142D50]` (Subtle brand surface)
  - Selected Border: `border-[#194D9C] ring-2 ring-[#194D9C]/25`
  - Elevated Icon Box: `bg-[#194D9C] text-white shadow-md shadow-[#194D9C]/30`
  - Title Text: `dark:text-[#E8EEF8]` (Crisp, bright white-blue)
  - Description Text: `dark:text-[#94A3B8]` (Clear blue-grey)
  - Selected Radio: Outer `border-[#194D9C] dark:bg-[#0F192C]` with inner dot `w-2 h-2 rounded-full bg-[#194D9C]`
  - Inactive Cards: `dark:bg-[#0F192C] dark:border-[#24344D] dark:hover:bg-[#17243A]`

### B. Total Acquired Devices Card (`OverviewPage.tsx`)
- **Before:** Pale grey/lavender background leaking from light-mode fallback, low-contrast text.
- **After:**
  - Card Background: `dark:bg-[#142D50]` (Deep subtle navy)
  - Card Border: `dark:border-[#194D9C]/60` (Subtle brand blue)
  - Heading: `dark:text-[#E8EEF8]`
  - Supporting Metric: `dark:text-blue-300 font-bold`
  - Icon Container: `w-9 h-9 rounded-xl bg-white/80 dark:bg-[#194D9C] flex items-center justify-center text-brand-600 dark:text-white shadow-sm`
  - Nested In-Stock & Sales Cards: `dark:bg-[#17243A] dark:border-[#24344D]`

### C. KPI Metrics Grid (`StatCard.tsx`)
- **Before:** Blue KPI icon box falling back to white (`#eff6ff`) in dark mode; card backgrounds using generic slate.
- **After:**
  - Card Container: `dark:bg-[#0F192C] dark:border-[#24344D]` with hover `dark:hover:border-[#194D9C]`
  - Blue Icon Box (Active Staff): `dark:bg-[#142D50] dark:text-blue-300 dark:border-[#194D9C]/60`
  - Green Icon Box (Attendance): `dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800/60`
  - Amber Icon Box (Leads): `dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800/60`
  - Purple Icon Box (Gross Profit): `dark:bg-purple-950/80 dark:text-purple-400 dark:border-purple-800/60`
  - Value Numbers: `dark:text-[#E8EEF8]`
  - Metric Subtitles: `dark:text-[#94A3B8]`

### D. Navigation Sidebar & Top Header (`DashboardLayout.tsx`)
- **Sidebar Canvas:** `dark:bg-[#0D1729] dark:border-[#24344D]`
- **Active Navigation Item:** `bg-brand-500 text-white shadow-sm shadow-brand-500/25`
- **Inactive Navigation Items:** `dark:text-[#94A3B8] dark:hover:bg-[#1C2A42] dark:hover:text-[#E8EEF8]`
- **Collapse Rail Button:** `dark:hover:bg-[#17243A]`
- **Footer Profile Card:** `dark:bg-[#17243A] dark:border-[#24344D]`, email `dark:text-[#94A3B8]`
- **Sign Out Button:** Fixed `w-7 h-7 dark:hover:bg-[#1C2A42]`
- **Top Header:** `dark:bg-[#0D1729]/95 backdrop-blur-md dark:border-[#24344D]`
- **Header Profile Dropdown:** `dark:bg-[#17243A] dark:border-[#24344D]`, items `dark:hover:bg-[#1C2A42]`

### E. Form Inputs, Selects, and Modals
- **Input (`Input.tsx`):** `dark:bg-[#0D1729] dark:border-[#24344D] dark:text-[#E8EEF8] dark:placeholder-[#71839D] focus:border-[#194D9C]`
- **Select (`Select.tsx`):** `dark:bg-[#0D1729] dark:border-[#24344D] dark:text-[#E8EEF8]`, options `dark:bg-[#0D1729]`, chevron `dark:text-[#71839D]`
- **ExportDropdown (`ExportDropdown.tsx`):** Trigger `dark:bg-[#0D1729] dark:border-[#24344D]`, menu `dark:bg-[#17243A] dark:border-[#24344D]`, options `dark:hover:bg-[#1C2A42]`
- **Modal (`Modal.tsx`):** Container `dark:bg-[#0F192C] dark:border-[#24344D]`, header divider `dark:border-[#24344D]`, close button `dark:hover:bg-[#17243A]`
- **Table Pagination (`TablePagination.tsx`):** Bar `dark:bg-[#0F192C] dark:border-[#24344D]`, text `dark:text-[#94A3B8]`, entries `dark:text-[#E8EEF8]`, rows selector `dark:border-[#24344D] dark:text-[#E8EEF8]`
- **Buttons (`Button.tsx`):** Outline variant `dark:bg-[#0D1729] dark:border-[#24344D] dark:hover:bg-[#17243A] dark:text-[#E8EEF8]`, secondary `dark:bg-[#17243A] dark:hover:bg-[#1C2A42]`

---

## 4. Verification Across All 12 Modules

| # | Page Module | Verified Dark Mode Enhancements |
|:---|:---|:---|
| 1 | **Dashboard Overview** | Deep navy `#070D1B` background, `#0F192C` welcome banner with solid brand top border, `#142D50` blue icon container, `#142D50` Total Acquired Devices box, and `#194D9C` active performance window pill. |
| 2 | **Staff Management** | Tab selector bar `#0D1729` with `#194D9C` active pill, table headers `#0D1729` with `#24344D` dividers, table container `#0F192C`, and outline action buttons. |
| 3 | **Attendance Tracker** | 4-column filter row with synchronized `#0D1729` inputs, `#0D1729` quick preset container with `#1C2A42` hover pills, and `#0F192C` attendance records table. |
| 4 | **Leads & Inquiries** | Status tabs with `#194D9C` active highlight, `#0D1729` customer search and stage filters, and elevated `#0F192C` lead cards and tables. |
| 5 | **Second-Hand Devices** | Purchases and sales tables rendered on `#0F192C` with `#0D1729` table headers and `#17243A` modal dialog surfaces. |
| 6 | **Mobile Price Catalog** | Brand selector chips with `#194D9C` active state, `#0F192C` device catalog table, and `#0F192C` price revision history card. |
| 7 | **Salary & Payroll** | Month picker on `#0D1729` with `#24344D` border, `#0F192C` staff payroll register, and `#142D50` summary badge. |
| 8 | **Reports & Analytics** | Scope selector bar on `#0F192C` with `#0D1729` month input, high-contrast chart labels on `#0F192C`, and `#0D1729` outline export button. |
| 9 | **Announcements & Alerts** | Priority badges (`emerald`, `amber`, `rose`) on `#0F192C`, announcement modal on `#0F192C` with `#0D1729` textarea, and `#0D1729` filter pills. |
| 10 | **Security & Audit Logs** | Immutable audit log table on `#0F192C` with `#0D1729` headers, `#194D9C` active timeframe pill, and `#17243A` log detail modal. |
| 11 | **Shop Settings** | Multi-column store configuration form inputs on `#0D1729` with `#24344D` borders, Google Maps coordinate links, and `#194D9C` primary save button. |
| 12 | **Profile & Security** | Solid `#194D9C` avatar, `#142D50` Dark Mode selected card with `#194D9C` border and icon box, `#17243A` password guidelines box, and `#0D1729` password inputs. |

---

## 5. Light Mode Preservation

Light Mode styling remains completely intact:
- Background: Clean `#F8FAFC` (`bg-slate-50`).
- Card Surfaces: Crisp `#FFFFFF` (`bg-white`) with subtle borders `border-slate-200/80`.
- Text: Deep `#0F172A` (`text-slate-900`) and `#475569` (`text-slate-600`).
- Primary Accents: Solid `#194D9C` (`bg-brand-500`).
- Switching seamlessly between Light, Dark, and System modes preserves all component geometry, spacing, and typographic scales without layout shift.

---

## 6. Build and Test Verification

### 1. Admin Dashboard Build
```
cd admin-dashboard && npm run build
vite v5.4.21 building for production...
✓ 1917 modules transformed.
✓ built in 2.18s
Result: 0 Errors, 0 Warnings
```

### 2. Admin Dashboard Vitest Suite
```
cd admin-dashboard && npm test
✓ src/__tests__/adminDashboard.test.ts (11 tests)
Test Files: 1 passed (1)
Tests:      11 passed (11)
Duration:   358ms
```

### 3. Root Mobile Project Jest Suite
```
npm test
Test Suites: 28 passed, 28 total
Tests:       300 passed, 300 total
Snapshots:   0 total
Time:        1.903s
```

---

## 7. Strict Constraints Compliance

1. **Brand Blue:** Strict preservation of `#194D9C` as primary anchor.
2. **Architecture:** No changes to React Native application files or dependencies.
3. **Firestore Security Rules:** Zero modifications. Production ruleset on `parthmobilecare-a474d` remains untouched.
4. **Production Data:** Zero writes or deletions to production collections.
5. **Deployment:** No production deployment executed. All changes are local and served live via the development server.

