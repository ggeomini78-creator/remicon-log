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
│   ├── kcal.js       # 한국 달력 데이터 (음력·공휴일·절기, 2024~2035) — app.js 보다 먼저 로드
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
  wwRate: 0,          // 폐수 건당 단가 (원)
  theme: "default",   // 테마 ID
  monthlyUnitPrices: {},  // { "YYYY-MM": 단가 } — 해당 월에만 적용. getUnitPrice(y,m) 로 조회

  // 달력 표시
  showLunar: true,    // 날짜 옆 음력
  showHoliday: true,  // 빨간날 + 공휴일 이름
  showTerm: false,    // 절기·기념일 (칸이 좁아 기본 꺼둠)
  lunarEvents: []     // 내가 등록한 기념일 [{name, lm, ld, leap, solar}]
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

달력 날짜 색: `--th-holiday`(일요일·공휴일), `--th-sat`(토요일), `--th-lunar`(음력·절기), `--th-event`(등록한 기념일).

---

## 📅 달력 데이터 (js/kcal.js)

**2024~2035년 12년치를 앱에 내장한다. 네트워크를 쓰지 않는다.**
네이버 캘린더는 외부 앱이 읽어갈 공개 API가 없고, 공공데이터포털 특일정보 API·구글
공휴일 캘린더는 API 키와 CORS가 필요하며 오프라인에서 동작하지 않는다.

| 데이터 | 저장 형태 | 출처 |
|---|---|---|
| 음력 | `KLUNAR` — 연도별 `{설날 양력, 윤달 번호, 월별 일수 비트열}` | KASI 기반 `korean_lunar_calendar` |
| 공휴일 | `KHOLI` — 연도별 `'MMDD이름,…'` 문자열 | `holidays` (SouthKorea). 대체·임시공휴일, 선거일, 2026 제헌절 재지정 포함 |
| 24절기 | `KTERM` — 연도별 일(日) 24개 | 태양 황경 15° 간격 (KST) |
| 한식·삼복 | `KMISC` | 동지+105일 / 하지·입추 기준 庚일 |

주요 함수:
- `kcLunar(y, m, d)` → `{ly, lm, ld, leap}` — **m 은 1-based** (`rCal()` 의 `m` 은 0-based이니 `m+1` 로 넘길 것)
- `kcLunarStr(y, m, d)` → `'6.18'` / `'윤6.18'` — 상세 화면용 (모든 날)
- `kcLunarMark(y, m, d)` → **초하루(음 1일)·보름(음 15일)에만** 문자열, 그 외엔 `''` — 달력 칸용
- `kcSolar(ly, lm, ld, leap)` → `'YYYY-MM-DD'`
- `kcMark(key)` → `{name, kind}` — 칸에 쓸 대표 이름. kind: `event` > `holi` > `term` 순
- `kcMarkAll(key)` → 배열 — 상세 헤더용 (기념일과 공휴일이 겹치면 둘 다)
- `kcIsHoliday(key)` → 빨간날 여부 (설정 토글과 무관하게 사실을 답한다)

**범위 밖(2023 이하 / 2036 이상)은 예외를 던지지 않고 빈 값/`null` 을 돌려준다.** 표시만 생략된다.
2036년 이후를 지원하려면 `KLUNAR`·`KHOLI`·`KTERM`·`KMISC` 에 연도를 추가하고 `KL_MAX`,
`KLUNAR_END` 를 올린다.

### 데이터를 손대면 반드시

콘솔에서 `kcSelfTest()` 를 돌린다. 월일수 합·양음력 왕복 4370일·명절 36건을 검사한다.

---

## 📱 PWA / 모바일 처리

- `apple-mobile-web-app-capable` 메타로 홈화면 풀스크린.
- **앱 아이콘**: Canvas로 동적 생성 → `apple-touch-icon` 링크 주입. (현재: 다크 배경 + 하늘색 "레미콘" + 밑줄)
  - iOS는 홈화면 추가 시점에 1회 캡처 → 변경 시 앱 삭제 후 재추가 필요.
- **하단 탭바**: `env(safe-area-inset-bottom)`으로 홈 인디케이터 영역 회피.
- **사진**: 카메라 촬영 시 OS가 갤러리 자동 저장. 앱은 base64로 리사이즈 저장.

### ⚠️ iOS PWA에서 절대 하지 말 것 — blob URL로 화면 이동

`display:standalone` 이라 **가장자리 가로 스와이프가 iOS의 뒤로/앞으로 가기**다.
`a.target='_blank'` 로 `blob:` URL을 열면 그 주소가 히스토리에 남고,
`revokeObjectURL()` 후엔 죽은 항목이 되어 달력을 넘기다 되돌아가면
`WebKitBlobResource 오류 1` 화면이 뜬다. (2026-08-01 수정)

- **백업은 `navigator.share({files})` 공유 시트를 쓴다** — 화면 이동이 없다.
  폴백 `dlBackup()` 도 **`target` 을 주지 않는다** (`app.js` 참조).
- 달력 가로 스와이프는 `touchmove` `{passive:false}` + `preventDefault()` 로 iOS
  제스처를 막는다. 단, 화면 맨 끝에서 시작한 스와이프는 못 막을 수 있다 — 보조 장치일 뿐.

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
