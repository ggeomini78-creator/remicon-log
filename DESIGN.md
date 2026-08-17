# DESIGN.md

This document defines the visual theme, design tokens, and components for the Remicon Driving Log app, supporting both the SpaceX dark theme, Linear dark theme, and White theme.

## 1. Visual Theme & Atmosphere
- **SpaceX Theme (Default)**: Austere, aerospace-inspired dark style. Deep black background, white text, and light-blue/cyan accents. Extremely clean, minimal decorative elements.
- **White Theme**: High-contrast light style. Soft white background (`#f8fafc`), black text, and dark accents.

## 2. Color Palette & Roles

### SpaceX Dark (Default)
순수 블랙(#000) 대신 표면 층이 구분되는 다크 그레이 스케일 사용 (시안성 개선, 2026-07).
- `--th-primary`: `#0c0f14` (base)
- `--th-bg`: `#0c0f14`
- `--th-bg2`: `#171c24` (raised surface)
- `--th-border`: `#2c333e`
- `--th-text`: `#f2f5f8`
- `--th-muted`: `#9aa3b0`
- `--th-accent`: `#ffffff`
- `--th-nav-active`: `#ffffff`
- `--th-btn-save`: `#ffffff`

### White Theme
보라끼 없는 중성 그레이 스케일.
- `--th-primary`: `#ffffff`
- `--th-bg`: `#ffffff`
- `--th-bg2`: `#f4f5f7`
- `--th-border`: `#e0e3e8`
- `--th-text`: `#111418`
- `--th-muted`: `#667080`
- `--th-accent`: `#111418`
- `--th-nav-active`: `#111418`
- `--th-btn-save`: `#111418`

### Calendar Day Colors
달력 날짜 숫자와 그 아래 이름 줄에 쓰는 색. 예전엔 주말 색이 `.cc:nth-child()` 안에
하드코딩돼 있었는데, 공휴일이 임의 요일에 오면서 변수로 뺐다 (2026-08).

| 변수 | 쓰임 | Dark | White |
|---|---|---|---|
| `--th-holiday` | 일요일 · 공휴일 (`.dn.holi`, `.dsub.holi`) | `#e05555` | `#d32f2f` |
| `--th-sat` | 토요일 | `#5588dd` | `#1a5fb4` |
| `--th-lunar` | 음력(`.lun`) · 절기·기념일(`.dsub`) | `#7d8794` | `#8a94a3` |
| `--th-event` | 내가 등록한 음력 기념일 (`.dsub.event`) | `#e8a33d` | `#b06000` |

- 오늘 날짜는 `.cc.today .dn` 이 `color:!important` 로 알약을 칠하므로, 오늘이 공휴일이면
  글자색 대신 **알약 자체를 빨갛게** 한다 (`.cc.today .dn.holi`).
- `.dn.holi` 규칙은 `.cc:nth-child(7n+1) .dn` 보다 **뒤에** 와야 한다. 특정도가 같아 순서로 이긴다.

### Icons
- 하단 탭·헤더 아이콘은 이모지가 아닌 인라인 SVG(stroke: currentColor, 1.8px) 사용 — 테마 색을 그대로 따른다.
- 달력의 바리수 뱃지는 히트맵 규칙: 1~2 파랑, 3~4 초록, 5~6 노랑/주황, 7~8 주황/빨강, 9+ 진빨강 (`cc()` 함수).

## 3. Calendar Status Badges Color System

Status badges on the calendar grid indicate daily activities and should adapt based on the chosen theme to ensure optimal readability and aesthetics.

| Activity | CSS class | Dark Mode (SpaceX & Linear) | Light Mode (White) |
|---|---|---|---|
| Fuel (주유) | `.mbadge.fuel` | Bg: `rgba(52, 211, 153, 0.12)`, Text: `#34d399` | Bg: `#e6f4ea`, Text: `#137333` |
| Overtime (오티) | `.mbadge.ot` | Bg: `rgba(167, 139, 250, 0.15)`, Text: `#a78bfa` | Bg: `#f3e8fd`, Text: `#681da8` |
| Toll (톨비) | `.mbadge.toll` | Bg: `rgba(96, 165, 250, 0.15)`, Text: `#60a5fa` | Bg: `#e8f0fe`, Text: `#1a73e8` |
| Wastewater (폐수) | `.mbadge.ww` | Bg: `rgba(5, 150, 105, 0.15)`, Text: `#34d399` | Bg: `#e6f4ea`, Text: `#137333` |
| 2h Overtime (2시↑) | `.mbadge.ot2` | Bg: `rgba(249, 115, 22, 0.15)`, Text: `#f97316` | Bg: `#fef7e0`, Text: `#b06000` |
| Photo (📷) | `.mbadge.photo` | Bg: `rgba(248, 113, 113, 0.24)`, Text: `#ff9b9b` | Bg: `#fce8e6`, Text: `#c5221f` |

## 4. Typography
- **Font Family**: Inter, Arial Narrow, Arial, sans-serif.
- **Font Sizes**:
  - Headers & Titles: 13px–18px (bold)
  - Default UI Body / Settings / Cards: 13px–14px
  - Calendar Day Numbers: 15px (bold)
  - Calendar Badges / Summary labels: 9px–10px
