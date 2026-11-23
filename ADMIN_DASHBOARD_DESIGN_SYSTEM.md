# Parth Mobile Care — Admin Web Dashboard Design System Specification

**Version:** 2.0.0  
**Target Environment:** `admin-dashboard/` (Vite, React 18, Tailwind CSS, Lucide Icons)  
**Primary Brand Anchor:** `#194D9C` (Synchronized with React Native Mobile App `src/theme/colors.ts`)  
**Design Aesthetic:** Apple & Linear-inspired clean SaaS interface (Light/Dark mode, crisp geometry, subtle borders, micro-interactions).

---

## 1. Design Philosophy & Principles

1. **Brand Continuity:** The web portal must speak the exact same visual vocabulary as the mobile application used by store staff. The core brand blue (`#194D9C`) establishes immediate trust and institutional recognition.
2. **Apple-Inspired Clarity:** Surfaces are predominantly clean white (`#FFFFFF`) or ultra-light slate (`#F8FAFC`), elevated with soft hairline borders (`#E2E8F0`) and delicate shadows (`shadow-sm`, `shadow-md`). Heavy, dark, saturated gradients are eliminated.
3. **High Information Density Without Clutter:** Mobile store management demands quick access to sales, attendance, prices, and leads. Data tables are compact, readable, vertically centered, and properly padded.
4. **Resilience & Responsiveness:** Seamless scaling from smartphone screens (<640px) via an off-canvas navigation drawer, to tablets (640–1023px) with adaptive grids, to widescreen desktop displays (1024px+) with collapsible sidebar rails.
5. **Clear Administrative Affordances:** Primary actions (Save, Approve, Export) are visually prominent; destructive actions (Reject, Deactivate, Delete) are unmistakably marked with warning accents and require explicit two-step confirmation.

---

## 2. Color Palette & Design Tokens

### 2.1 Brand Primary (Parth Blue)
Synchronized with React Native Mobile App:
```css
--brand-50:  #eff6ff; /* Tint surface */
--brand-100: #dbeafe; /* Light badge bg */
--brand-200: #bfdbfe; /* Subtle border */
--brand-500: #194D9C; /* PRIMARY BRAND ANCHOR */
--brand-600: #143e7e; /* Primary Hover */
--brand-700: #123A78; /* Active / Pressed */
--brand-800: #0d2854; /* Deep Accent */
--brand-900: #0a1e3e; /* Text Contrast Dark */
```

### 2.2 Semantic Status Colors
| Role | Color Token | Light Background | Dark Background | Border Token | Usage |
|---|---|---|---|---|---|
| **Success** | `#16A34A` (Emerald 600) | `#ECFDF5` (Emerald 50) | `#064E3B/60` | `#A7F3D0` | Present, Approved, Purchased, Active, Verified |
| **Warning** | `#D97706` (Amber 600) | `#FFFBEB` (Amber 50) | `#78350F/60` | `#FDE68A` | Late, Pending Approval, Follow-up Required, Grace Period |
| **Danger** | `#DC2626` (Rose 600) | `#FEF2F2` (Rose 50) | `#881337/60` | `#FECDD3` | Absent, Rejected, Deactivated, Lost Lead, Delete |
| **Info** | `#0284C7` (Sky 600) | `#F0F9FF` (Sky 50) | `#0C4A6E/60` | `#BAE6FD` | System Notice, Device Binding, Audit Info |
| **Neutral** | `#475569` (Slate 600) | `#F1F5F9` (Slate 100) | `#1E293B` | `#CBD5E1` | Draft, Unregistered, Inactive, Muted Tags |

### 2.3 Neutral Surfaces & Borders
- **App Background (Light):** `#F8FAFC` (`slate-50`)
- **Card / Surface (Light):** `#FFFFFF` (`white`)
- **App Background (Dark):** `#090D16` (Deep slate night)
- **Card / Surface (Dark):** `#0F172A` (`slate-900`)
- **Hairline Border (Light):** `#E2E8F0` (`slate-200`)
- **Hairline Border (Dark):** `#1E293B` (`slate-800`)
- **Divider Lines:** `#F1F5F9` (`slate-100`) / `#1E293B`

---

## 3. Typography Hierarchy

The typeface is `Inter, system-ui, -apple-system, sans-serif` for optimum legibility of numbers, prices, and status indicators.

| Level | Size / Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|
| **Display / Page Title** | `text-lg` or `text-xl` / Font-Bold (700) | `leading-tight` | `-0.02em` | Active Page Title, Modal Headers |
| **Section Title** | `text-sm` or `text-base` / Font-Bold (700) | `leading-snug` | `-0.01em` | Card Headers, Table Titles, Stat Card Values |
| **Navigation Header** | `text-[10px]` / Font-Bold (700) | `leading-none` | `+0.08em` | Sidebar Section Groups (OVERVIEW, OPERATIONS, etc.) |
| **Navigation Label** | `text-xs` / Font-SemiBold (600) | `leading-normal` | normal | Sidebar Navigation Buttons |
| **Table Headings** | `text-[11px]` / Font-Bold (700) | `leading-none` | `+0.05em` | Table Column Headers (`uppercase`) |
| **Body / Data** | `text-xs` / Font-Normal (400) or SemiBold (600) | `leading-relaxed`| normal | Table Cell Data, Form Values, Descriptions |
| **Micro Copy / Meta** | `text-[10px]` or `text-[11px]` / Font-Medium | `leading-tight` | normal | Timestamps, Secondary IDs, Subtitles |

---

## 4. Elevation, Radii & Spacing

### 4.1 Border Radii
- **Badges & Pills:** `rounded-full` (`9999px`)
- **Buttons & Form Inputs:** `rounded-xl` (`12px`)
- **Cards, Panels & Tables:** `rounded-2xl` (`16px`)
- **Modals & Dialogs:** `rounded-2xl` to `rounded-3xl` (`20px` to `24px`)

### 4.2 Shadows
- **Card Idle:** `shadow-sm` (`0 1px 2px 0 rgb(0 0 0 / 0.05)`)
- **Card Hover:** `hover:shadow-md` (`0 4px 6px -1px rgb(0 0 0 / 0.1)`)
- **Dropdown / Flyout:** `shadow-xl` (`0 20px 25px -5px rgb(0 0 0 / 0.1)`)
- **Modal Backdrop:** `backdrop-blur-sm` with `bg-slate-900/60`

---

## 5. Standard Component Specifications

### 5.1 Button Primitive (`Button.tsx`)
```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
}
```
- **Primary:** `bg-[#194D9C] hover:bg-[#143e7e] text-white shadow-sm font-semibold`
- **Secondary:** `bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200`
- **Outline:** `border border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:text-slate-200`
- **Ghost:** `hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300`
- **Danger:** `bg-rose-600 hover:bg-rose-700 text-white shadow-sm font-semibold`
- **Success:** `bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold`

### 5.2 Card Primitive (`Card.tsx`)
Container with uniform background, border, header actions, and body padding:
```tsx
<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
  {header && <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">{header}</div>}
  <div className="p-5">{children}</div>
</div>
```

### 5.3 Form Inputs (`Input.tsx` & `Select.tsx`)
- Standardized heights: `h-9` (compact) or `h-10` (standard).
- Left-icon slot for search/filter icons.
- Right-icon slot for clear/calendar icons.
- Focus state: `focus:ring-2 focus:ring-[#194D9C]/20 focus:border-[#194D9C]`.

### 5.4 Export Dropdown (`ExportDropdown.tsx`)
A unified split or dropdown button providing:
- **Export to Excel (.xlsx)** via `exportToExcel(data, filename)`
- **Export to CSV (.csv)** via `exportToCsv(data, filename)`

### 5.5 Table Pagination (`TablePagination.tsx`)
- Left: "Showing **{start}** to **{end}** of **{total}** records"
- Right: Previous, Page Numbers (1, 2, 3...), and Next buttons.
- Selectable rows-per-page (10, 25, 50, 100).

---

## 6. Layout Grid System
- **Mobile (<640px):** Single column, 16px page padding, off-canvas navigation drawer.
- **Tablet (640–1023px):** 2-column KPI grid, 20px page padding, collapsible sidebar.
- **Desktop (1024px+):** 4-column KPI grid, 24px page padding, 64-width sidebar, max content width 1400px.

