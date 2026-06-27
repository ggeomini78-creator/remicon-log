# DESIGN.md

This document defines the visual theme, design tokens, and components for the Remicon Driving Log app, supporting both the SpaceX dark theme, Linear dark theme, and White theme.

## 1. Visual Theme & Atmosphere
- **SpaceX Theme (Default)**: Austere, aerospace-inspired dark style. Deep black background, white text, and light-blue/cyan accents. Extremely clean, minimal decorative elements.
- **White Theme**: High-contrast light style. Soft white background (`#f8fafc`), black text, and dark accents.

## 2. Color Palette & Roles

### SpaceX Dark (Default)
- `--th-primary`: `#000000` (pure black)
- `--th-bg`: `#000000`
- `--th-bg2`: `#0a0a0a` (near black surface)
- `--th-border`: `#3a3a3f`
- `--th-text`: `#ffffff`
- `--th-muted`: `#8a8a90`
- `--th-accent`: `#ffffff`
- `--th-nav-active`: `#ffffff`
- `--th-btn-save`: `#ffffff`

### White Theme
- `--th-primary`: `#ffffff`
- `--th-bg`: `#ffffff`
- `--th-bg2`: `#f0f0fa`
- `--th-border`: `#d0d0d8`
- `--th-text`: `#000000`
- `--th-muted`: `#3a3a3f`
- `--th-accent`: `#000000`
- `--th-nav-active`: `#000000`
- `--th-btn-save`: `#000000`

## 3. Calendar Status Badges Color System

Status badges on the calendar grid indicate daily activities and should adapt based on the chosen theme to ensure optimal readability and aesthetics.

| Activity | CSS class | Dark Mode (SpaceX & Linear) | Light Mode (White) |
|---|---|---|---|
| Fuel (주유) | `.mbadge.fuel` | Bg: `rgba(52, 211, 153, 0.12)`, Text: `#34d399` | Bg: `#e6f4ea`, Text: `#137333` |
| Overtime (오티) | `.mbadge.ot` | Bg: `rgba(167, 139, 250, 0.15)`, Text: `#a78bfa` | Bg: `#f3e8fd`, Text: `#681da8` |
| Toll (톨비) | `.mbadge.toll` | Bg: `rgba(96, 165, 250, 0.15)`, Text: `#60a5fa` | Bg: `#e8f0fe`, Text: `#1a73e8` |
| Wastewater (폐수) | `.mbadge.ww` | Bg: `rgba(5, 150, 105, 0.15)`, Text: `#34d399` | Bg: `#e6f4ea`, Text: `#137333` |
| 2h Overtime (2시↑) | `.mbadge.ot2` | Bg: `rgba(249, 115, 22, 0.15)`, Text: `#f97316` | Bg: `#fef7e0`, Text: `#b06000` |

## 4. Typography
- **Font Family**: Inter, Arial Narrow, Arial, sans-serif.
- **Font Sizes**:
  - Headers & Titles: 13px–18px (bold)
  - Default UI Body / Settings / Cards: 13px–14px
  - Calendar Day Numbers: 15px (bold)
  - Calendar Badges / Summary labels: 9px–10px
