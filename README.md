# 🚛 레미콘 운행일지 (Remicon Driving Log)

레미콘(콘크리트 믹서트럭) 운전기사를 위한 개인용 운행일지 PWA. 순수 HTML/CSS/JS로 작성되었으며 외부 라이브러리 의존성이 없고, 모든 데이터는 브라우저 `localStorage`에 저장된다.

- **배포**: GitHub Pages — https://ggeomini78-creator.github.io/remicon-log/
- **기술 스택**: Vanilla JS (ES5 문법), localStorage, Canvas (앱 아이콘 생성)
- **타겟**: 모바일 (iOS Safari / Android Chrome), 홈화면 추가 PWA

---

## 📁 파일 구조

```
remicon-log/
├── index.html        # HTML 뼈대 (헤더 + #mc 컨테이너 + 하단 탭바 4개)
├── manifest.json     # PWA 매니페스트
├── sw.js             # 서비스워커 (오프라인 캐시)
├── css/
│   └── style.css     # 전체 스타일 + 테마 CSS 변수 (--th-*)
├── js/
│   └── app.js        # 전체 기능 코드 (단일 파일, 전역 함수 기반)
├── DESIGN.md         # 디자인 토큰/테마 정의 문서
└── .github/
    └── workflows/
        └── static.yml # GitHub Pages 자동 배포
```

빌드 과정 없음. 파일을 그대로 정적 호스팅하면 동작한다.

---

## 🗂️ 데이터 구조 (localStorage)

### 키
- `rl9_logs` — 날짜별 기록 (구버전 `rl8_logs` 자동 마이그레이션)
- `rl9_cfg` — 앱 설정

### cfg 기본값
```js
{
  unitPrice: 74300,   // 바리당 단가 (원) — 기본급 = 바리수 × unitPrice
  fuelRate: 0.55,     // km당 유류 소모량 (L/km)
  otRate: 18000,      // 오티 시간당 단가 (원)
  fuelPrice: 1500,    // 연료 정산 단가 (원/L)
  toll1: 3600,        // 톨비 대형 (원)
  toll2: 2400,        // 톨비 소형 (원)
  initKm: 125000,     // 기준 km (앱 시작 시점 차량 누적 km)
  ot2Pay: 0,          // 2시간초과 건당 단가 (원)
  theme: "default"    // 테마 ID
}
```

### log 항목 구조 (logs[“YYYY-MM-DD”])
```js
{
  st: "work"|"vacation"|"repair"|"other",  // 근무상태 (UI: 근무/휴무/정비/기타)
  calls: "6",        // 바리수
  vol: "36",         // 운반량 (㎥) — 바리수×6 자동입력
  skm: "125000",     // 시작 km
  ekm: "125075",     // 종료 km
  fuel: "200",       // 당일 주유량 (L)
  ot: "2",           // 오티 시간
  ot2List: "[...]",  // 2시간초과 현장 (JSON 문자열)
  wwList: "[...]",   // 폐수처리 현장 (JSON 문자열)
  t1: "1",           // 톨비 대형 횟수
  t2: "0",           // 톨비 소형 횟수
  repList: "[...]",  // 정비 내역 (JSON 문자열)
  cashList: "[...]", // 일반현장 현금거래 (JSON 문자열)
  memo: "...",       // 메모
  photo: "data:..."  // 사진 (base64 JPEG, 최대 1200×1600 리사이즈)
}
```

### 하위 리스트 구조
```js
// ot2List 항목
{ site:"현장명", mgr:"영업사원", type:"credit"|"monthly", settled:false }
//   type=credit: 영업사원 콜 지급 / type=monthly: 월말 결산
//   settled=true: 정산완료 (UI에서 취소선 표시, 결산에서 제외)

// wwList 항목
{ site:"현장명" }

// repList 항목
{ item:"엔진오일 교체", place:"정비소명", cost:"50000" }

// cashList 항목 — 잔량 판매 (참고용, 결산 미포함. km만 전체 누적 km에 반영)
{ site:"현장 위치", mgr:"담당자", amt:"150000", km:"18" }
```

---

## 🧩 주요 기능 (탭 구성)

하단 탭바에는 4개 탭(달력/통계/연말결산/설정)만 노출되며, **기록 화면은 달력에서 날짜를 탭해 진입**한다. `tab` 전역변수 + `go(tabName)` + `render()`로 전환.

| 화면 | 함수 | 진입 | 설명 |
|----|------|------|------|
| 📅 달력 | `rCal()` | 탭바 | 월별 캘린더. 셀에 바리수/폐수/오티/주유/톨비/사진 뱃지 표시. 화면 꽉차게 채움. 좌우 스와이프로 월 이동(애니메이션). |
| ✏️ 기록 | `rEntry()` | 달력 날짜 탭 | 날짜별 상세 입력 폼. 근무상태/바리수/km/연료/오티/2시간초과/폐수/톨비/정비/메모/사진. |
| 📊 통계 | `rStats()` | 탭바 | 월말결산. 기본급/오티/2시간초과/톨비/정비 합산. **유류는 정산에서 제외**(월별 리셋, 현황만 표시). |
| 🏆 연말결산 | `rAnnual()` | 탭바 | 12개월 테이블 + 연간 합계. 연도 이동 가능. |
| ⚙️ 설정 | `rConfig()` | 탭바 | 테마 선택 / 단가 설정 / 백업·복원 / 초기화. |

---

## ⚙️ 핵심 계산 로직 (주의 깊게 다룰 것)

### 기본급
```
기본급 = 총 바리수(tc) × cfg.unitPrice
```
※ "일당"이 아니라 **바리당** 단가. 근무일수 곱하지 말 것.

### 유류 (★ 월별 리셋, 부호 주의)
- **매월 1일 리셋**. 이전 달 누적 이월 없음.
- `fuelMonth(y,m)` — 해당 월 주유량(mf)·소비량(mu) 집계
- `fuelMonthExclude(date)` — 기록 탭에서 당일 제외 이달 합계
- **부호 규칙**: `diff = 소비량 - 주유량`
  - `diff >= 0` (소비 > 주유) → 🟢 초과소비 → **지급 받음**
  - `diff < 0` (주유 > 소비) → 🔴 잔량 → **도급비 차감**
  - ⚠️ 운전기사가 받는 돈 기준. 소비가 많을수록 받는 구조.
- 유류는 **월말결산/연말결산 금액에 포함하지 않음** (별도 정산).

### 오티 수당
```
오티수당 = ot시간 × cfg.otRate
```

### 2시간초과
- `type:"monthly"` 이고 `settled:false`인 건만 월말결산에 `ot2Pay` 단가로 합산.
- `settled:true` 건은 결산에서 제외 + 통계/캘린더에서 취소선·반투명 표시.

### 톨비
```
톨비 = t1×cfg.toll1 + t2×cfg.toll2
```

### 누적 km
```
현재 총 km = cfg.initKm + 전체기간 운행거리 합(Σ(ekm-skm))
```

### 금액 표시
- **반올림·절삭 금지**. `toLocaleString()`으로 전체 금액 표시 (예: 445,800원).
- 금액 자릿수에 따라 폰트 크기 자동 조정.

---

## 🎨 테마 시스템

- CSS 커스텀 프로퍼티(`--th-*`)를 `:root`에 정의, 테마별로 `html.theme-{id}`에서 오버라이드.
- `applyTheme(id)` — `<html>`의 `theme-*` 클래스만 교체 (다른 클래스 보존).
- 2종: `default`(SpaceX 다크 — 순수 블랙 + 화이트 액센트), `white`(화이트).
- `setTheme(id)` → cfg 저장 + applyTheme + rConfig 재렌더.
- 상세 토큰/뱃지 색상 정의는 `DESIGN.md` 참조.

주요 변수: `--th-primary`, `--th-accent`, `--th-bg`, `--th-bg2`, `--th-border`, `--th-text`, `--th-muted`, `--th-nav-active`, `--th-btn-save`.

---

## 📱 PWA / 모바일 처리

- `apple-mobile-web-app-capable` 메타로 홈화면 풀스크린.
- **앱 아이콘**: Canvas로 동적 생성 → `apple-touch-icon` 링크 주입. (현재: 다크 배경 + 하늘색 "레미콘" + 밑줄)
  - iOS는 홈화면 추가 시점에 1회 캡처 → 변경 시 앱 삭제 후 재추가 필요.
- **하단 탭바**: `env(safe-area-inset-bottom)`으로 홈 인디케이터 영역 회피.
- **사진**: 카메라 촬영 시 OS가 갤러리 자동 저장. 앱은 base64로 리사이즈 저장.

---

## 🐛 알려진 제약

- 데이터는 브라우저 localStorage에만 존재 → 브라우저 캐시 삭제 시 소실. 설정 탭의 백업(.json) 권장.
- 웹앱 특성상 타 네이티브 앱(차계부 등)과 직접 연동 불가. (CSV/ics 내보내기는 향후 가능)
- 단일 사용자용. 멀티 디바이스 동기화 없음 (백업 파일 수동 이전).

---

## 🚀 향후 작업 후보 (TODO)

- [ ] 정비 일정 → 캘린더(.ics) 내보내기
- [ ] 기록 CSV 내보내기 (차계부 앱 가져오기용)
- [ ] 구글 시트/드라이브 클라우드 백업 연동
- [ ] 월별 유류 정산 리셋 경계 케이스 테스트
- [ ] 데이터 마이그레이션 버전 관리 (rl9 → rl10)

---

## 💻 로컬 실행

```bash
# 정적 서버 아무거나
python3 -m http.server 8000
# 또는
npx serve .
```
브라우저에서 `http://localhost:8000` 접속. (모바일 테스트는 기기 개발자도구 또는 같은 네트워크 IP 접속)

---

## 📝 코드 컨벤션 메모

- ES5 문법 사용 (`var`, `function`). 화살표 함수/const 미사용 — 구형 모바일 호환 목적.
- 전역 함수 + 전역 상태 변수 패턴. 모듈 시스템 없음.
- HTML은 템플릿 리터럴 아닌 문자열 concat(`+`)으로 생성 — 수정 시 따옴표 이스케이프 주의.
- 인라인 `onclick` 핸들러 다수 사용.
