# ADHD-Dev: CLI-Integrated Focus Tool - 구현 명세서 v3

> ADHD 성향의 개발자가 멀티 CLI/AI 코딩 환경에서 집중력을 유지하도록 돕는 CLI 통합 도구
> **현재 완성본 기준 재현 가능한 상세 구현 명세서**

> **Version**: v3 (2026-03-27) - 실제 구현 기반 역설계
> **Original**: Plan B CLI-Integrated Focus Tool (2026-03-24)
> **변경점**: ink → raw ANSI TUI, sql.js → JSON 파일 기반, 가재 게이미피케이션 + 픽셀 애니메이션 추가, 토큰 Decay 시스템, CJK 문자 폭 처리, 자연어 활동 표시

---

## RALPLAN-DR Summary

### Principles (핵심 설계 원칙)

1. **Terminal-Native**: 개발자가 이미 작업하는 환경(터미널) 안에서 동작. 별도 GUI 전환 없이 컨텍스트 유지
2. **Zero-Friction Integration**: Claude Code hooks/filesystem을 활용한 자동 연동. 수동 설정 최소화
3. **Non-Judgmental by Default**: 심리학적 원칙 계승. 감시가 아닌 자기인식 도구
4. **Progressive Enhancement**: 단순 CLI 명령어부터 시작하여 daemon, TUI, prompt 통합으로 점진 확장
5. **Gamification over Guilt**: 가재 진화 시스템으로 작업을 게임화. 처벌이 아닌 성장 동기 부여

### 선택된 아키텍처: Daemon + CLI + Raw ANSI TUI + Hooks

**근거**: Dopamine Architecture의 5개 메커니즘 모두 구현 가능한 유일한 옵션. daemon이 AdaptiveEngine과 SignalEmitter를 호스팅하고, shell prompt/tmux가 passive visibility를 담당.

**변경된 기술 선택**:
- ~~ink (React for CLI)~~ → **raw ANSI escape sequences + chalk**: 의존성 최소화, halfblock 픽셀 아트와 직접 호환
- ~~sql.js (WASM SQLite)~~ → **JSON 파일 기반**: 설치 복잡성 제거, 데이터량이 극소하므로 SQL 불필요
- **추가**: 가재 진화 게이미피케이션, 픽셀 애니메이션, 토큰 Decay

---

## 1. Requirements Summary

### Problem Statement
현대 개발자들은 다수의 Claude Code CLI 세션을 동시에 실행하며 작업한다. AI 처리 대기 시간 동안 컨텍스트 스위칭이 빈번하게 발생하고, 특히 ADHD 성향의 개발자는 이 과정에서 주의가 분산되어 생산성이 크게 저하된다. **별도 GUI 앱으로 전환하는 것 자체가 추가적인 컨텍스트 스위칭을 유발**하므로, 개발자가 이미 작업 중인 터미널 환경 내에서 집중 지원 도구가 동작해야 한다.

### Target User
- 멀티 CLI 환경에서 Claude Code를 복수로 운영하는 개발자
- ADHD 성향이 있거나 주의력 관리가 필요한 개발자
- 터미널 중심 워크플로우 선호자 (tmux, Warp, iTerm2, kitty 등)
- macOS / Linux 사용자

### Core Features (구현 완료)
1. **Claude Code 세션 디스커버리** - PID.json → sessionId → path-encoded project → UUID.jsonl 조인 기반 자동 세션 탐지
2. **가재 진화 게이미피케이션** - 토큰 사용량에 따라 Baby → King 진화, 4프레임 픽셀 애니메이션
3. **토큰 Decay 시스템** - 비활성 시 토큰 감소로 FOMO 유발, 지속적 작업 동기 부여
4. **자연어 활동 표시** - 도구 이름 대신 Claude의 실제 작업 내용 표시
5. **유연한 집중 타이머** - ADHD 친화적 가변 인터벌. 터미널/시스템 알림 지원
6. **세션 대시보드 (Raw ANSI TUI)** - 동적 그리드 레이아웃에서 전체 세션 상태 한눈에 파악
7. **Passive Visibility** - Shell prompt + tmux status-bar 통합
8. **Dopamine Architecture (CLI 적응)** - 5개 도파민 메커니즘의 터미널 환경 적응

---

## 2. Psychological Framework (CLI 환경 적응)

### MVP에 적용할 핵심 이론: ADHD 외부 실행기능 보조

| 이론 | CLI 환경 적용 | 구현 방식 |
|------|-------------|---------|
| **ADHD 신경과학** | 가재 진화로 마이크로 보상 제공. 토큰 decay로 손실 회피 (단, 판단 없이) | 레벨 진화 시 황금 테두리 플래시. 토큰 증가 초록 ↑, 감소 빨간 ↓ |
| **인지부하 이론 (CLT)** | TUI 대시보드에서 최대 4-5개 세션만 우선 표시. CLI 출력은 핵심 정보만 | 카드 기반 그리드, 자연어 1줄 요약 |
| **Flow State 이론** | 터미널 환경을 떠나지 않아 플로우 유지. prompt 통합이 passive | alt-screen buffer, 2초 자동 갱신 |
| **행동경제학** | 가재가 쉬면 레벨 하락 → 작업 시키고 싶은 충동 유발 | 지수 감소 decay: idle 2%/h, sleeping 5%/h |
| **게이미피케이션** | 가재 키우기로 작업을 게임화. 스프라이트 진화가 보상 | 5레벨 × 4상태 × 4프레임 픽셀 아트 |

### 핵심 설계 원칙

1. **판단하지 않기 (Non-judgmental)**: RSD 방지. 부정적 표현 절대 불가
2. **외부 작업기억 역할**: `adhd where` 한 번으로 "어디까지 했는지" 즉시 복원
3. **유연한 구조 제공**: 타이머 강제 없음. 사용자가 선택하는 구조
4. **점진적 개입**: prompt 표시는 passive. daemon은 설정 시에만 알림 전송
5. **감시가 아닌 자기인식 도구**: 모든 데이터는 로컬. 네트워크 전송 없음

---

## 3. Dopamine Architecture - CLI 적응

> 업무 자체가 보상이 되는 시스템. 5개 도파민 메커니즘을 터미널/CLI 환경에 맞게 설계.
> GUI 애니메이션/아이콘 대신 **shell prompt, tmux status-bar, terminal title, ANSI escape, terminal bell**을 활용.

### CLI 신호 전달 채널 (Signal Channels)

| 채널 | 설명 | Passive 여부 | 적용 메커니즘 |
|------|------|-------------|-------------|
| **Shell Prompt** | PS1/PROMPT에 삽입되는 상태 문자열. 매 명령 후 갱신 | Passive | Momentum Pulse, Rhythm Anchor, Context Warmth |
| **Tmux Status Bar** | tmux status-right에 삽입. 상시 표시 | Passive | 모든 메커니즘 |
| **Terminal Title** | `\033]0;title\007` escape sequence로 탭 타이틀 변경 | Passive | Rhythm Anchor, Timer 상태 |
| **Terminal Bell** | `\a` (BEL). 타이머 완료, 과집중 알림 | Active (1회성) | Completion Ripple, Rhythm Anchor |
| **System Notification** | `node-notifier` 기반 OS 알림 | Active (1회성) | Completion Ripple, Rhythm Anchor |
| **TUI Dashboard** | `adhd dash` 실시간 대시보드 | On-demand | 모든 메커니즘 + 가재 시각화 |

### 메커니즘 1: Momentum Pulse (모멘텀 펄스)

**신경학적 기반**: 복측 피개 영역(VTA)의 보상 예측 오류(RPE). 예측 불가능한 타이밍의 미세 신호로 RPE를 증폭.

**CLI 작동 방식**:
- daemon이 `~/.claude/projects/*/UUID.jsonl` 파일 변경 감지 → "교환 완료" 이벤트 발생
- **Shell prompt 변화**: prompt 내 indicator가 순간적으로 변화
  - 평상시: `[~]` (neutral)
  - 교환 감지 직후: `[*]` (pulse, 다음 프롬프트 렌더 시 1회만)
  - 피보나치 뱃지(3, 5, 8회): `[*5]` (숫자 표시, 3회 프롬프트 동안 유지)
- **핵심**: prompt 갱신은 사용자가 Enter를 칠 때만 발생 → 자연스럽게 비동기적

**구현 (signal-emitter.ts)**:
```typescript
const FIBONACCI = [3, 5, 8, 13, 21, 34, 55, 89];
const MIN_PROMINENT_SIGNAL_INTERVAL_MS = 5 * 60 * 1000; // 5분 간격 제한

function canEmitProminentSignal(): boolean {
  if (state.quietMode) return false;
  if (isBadDayDetected()) return false;
  return Date.now() - state.lastProminentSignalAt >= MIN_PROMINENT_SIGNAL_INTERVAL_MS;
}
```

**적응형 행동**:
- 기준선 수집 (첫 7일): 사용자의 평균 교환 빈도, 세션 길이 학습
- 활동 수준 70% 미만 → pulse 뱃지 간격을 줄임 (격려)
- 활동 수준 130% 이상 → pulse 빈도 낮춤

**과자극 방지**:
- 5분 내 최대 1회 prominent 신호
- 3회 연속 뱃지 무응답(세션 진행 없음) → "조용 모드" 진입
- 설정: `signals.momentum: "on" | "subtle" | "off"`

### 메커니즘 2: Completion Ripple (완료 파문)

**신경학적 기반**: 측좌핵(NAcc)의 강화 학습. 큰 목표를 작은 완료 단위로 분절하여 즉각적 보상감 제공.

**CLI 작동 방식**:
- 타이머 세션 완료 시:
  - Terminal bell: `\a` 1회
  - System notification: `node-notifier`로 OS 알림
  - Shell prompt: 완료 마커 `[v]` 표시 (3회 프롬프트 동안)
  - CLI 출력: `++ 25분 집중 완료 | 오늘 3세션 | 총 1h 45m ++`
- 가재 레벨업 시: TUI에서 황금 테두리 3프레임 플래시

**적응형 행동**:
- 짧은 세션(5-15분): prompt 변화만 (최소 신호)
- 긴 세션(30분+): bell + prompt + notification (풍부한 신호)
- **나쁜 날 감지**: 60분 내 productive < 10분 → 모든 능동적 신호 억제 ("지지적 침묵")

**과자극 방지 (하드코딩)**:
- 절대 "스트릭" 카운팅 없음
- 절대 손실 프레이밍 없음
- 절대 이전 기록과 자동 비교 없음
- 세션이 없으면 빈 상태 표시

### 메커니즘 3: Context Warmth (컨텍스트 온기)

**신경학적 기반**: 전전두엽 피질(PFC)의 작업기억과 과제 개시. 이미 진행 중인 작업의 "따뜻한" 상태를 보여주어 재진입 활성화 에너지를 낮춤.

**CLI 작동 방식**:
- 세션 목록의 ANSI 색상 차이:
  - 5분 이내 활동: warm (yellow)
  - 30분 이내: medium (white)
  - 1시간+: cool (dark gray)
- TUI 대시보드: 가재 상태로 온도 표현
  - working (●) = 활발하게 움직이는 가재
  - idle (◐) = 가만히 있는 가재
  - sleeping (○) = 잠자는 가재

**구현**:
```typescript
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 18) return 'EVE';
  if (hour >= 12) return 'PM';
  return 'AM';
}

function computeWarmth(lastActivityMs: number): string {
  if (lastActivityMs < 5 * 60 * 1000) return 'warm';
  if (lastActivityMs < 30 * 60 * 1000) return 'medium';
  return 'cool';
}
```

### 메커니즘 4: Rhythm Anchor (리듬 앵커)

**신경학적 기반**: ADHD의 시간 인지 장애(time blindness). 외부 시간 구조를 제공하되, 경직되지 않게.

**CLI 작동 방식**:
- Shell prompt 시간대 반영: `[AM]` / `[PM]` / `[EVE]`
- 집중 세션 진행 중: 남은 시간 `[18:42]` + 프로그레스 바
- 과집중(hyperfocus) 알림: 90분 초과 연속 활동 시 bell 1회 + notification

**적응형 행동**:
- 사용자의 자연스러운 집중 피크 시간대 학습 (7일 기준선)
- 피크 시간대에는 시간 체크포인트 억제

### 메커니즘 5: Return Bridge (복귀 다리)

**신경학적 기반**: Barkley의 실행기능 모델 - 주의 이탈 후 돌아오는 전환 마찰 최소화.

**CLI 작동 방식**:
- 세션 비활성 2분+ → 상태를 "away"로 마킹
- Shell prompt: `[← project-name]` 복귀 힌트 1회 표시
- `adhd go <session>` 원커맨드 복귀 (shell function wrapper)

**구현**:
```typescript
// dopamine-service.ts
case 'session-stop': {
  mostRecentIdleProject = event.session.projectName;
  emitSignal({
    type: 'idle',
    returnToProject: mostRecentIdleProject,
    force: true,
  });
  break;
}
```

### DopamineService 아키텍처

```
┌─────────────────────────────────────────────────────┐
│              DopamineService (daemon 내부)            │
│  ┌───────────────────────────────────────────────┐   │
│  │           AdaptiveEngine                      │   │
│  │  - 기준선 모델 (7일 학습)                        │   │
│  │  - 5개 입력 신호 → 4개 출력 파라미터              │   │
│  │  - 규칙 기반 (ML 아님)                           │   │
│  │  - 파라미터 변경: 하루 최대 1회 (자정 재계산)       │   │
│  └──────────┬────────────────────────────────────┘   │
│             │                                        │
│  ┌──────────┴────────────────────────────────────┐   │
│  │           SignalEmitter                        │   │
│  │  - 신호 빈도 제한 (5분/1회 prominent)             │   │
│  │  - 과자극 감지 (3회 무시 → 조용 모드)              │   │
│  │  - 나쁜 날 감지 → 지지적 침묵                     │   │
│  │  - 피보나치 뱃지: [3,5,8,13,21,34,55,89]         │   │
│  └──────────┬────────────────────────────────────┘   │
│             │                                        │
│  ┌──────────┴────────────────────────────────────┐   │
│  │    Signal Types (CLI 출력 채널)                 │   │
│  │  - PromptUpdate → prompt-state.json 기록        │   │
│  │  - TmuxUpdate → tmux status 문자열 갱신          │   │
│  │  - TerminalTitle → escape sequence 전송          │   │
│  │  - Bell → terminal bell 트리거                   │   │
│  │  - Notification → node-notifier OS 알림          │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  입력 ← FileWatcher (세션 .jsonl 변경 이벤트)         │
│  입력 ← TimerEngine (타이머 이벤트)                   │
│  입력 ← HookReceiver (Claude Code hook 이벤트)       │
│  입력 ← SessionTracker (세션 활성/비활성 상태)         │
│                                                      │
│  출력 → prompt-state.json (shell prompt helper 읽기) │
│  출력 → Unix socket (TUI 대시보드 실시간 업데이트)     │
└─────────────────────────────────────────────────────┘
```

### 적응형 엔진 상세

**입력 신호 (5개)**:
```typescript
interface DaySignals {
  date: string;                        // YYYY-MM-DD
  productiveAppTimeRatio: number;      // 0–1: 세션 활동 시간 비율
  sessionSwitchFrequency: number;      // switches/hour: 세션 전환 빈도
  timerCompletionRate: number;         // 0–1: 타이머 완료율
  popoverFrequency: number;            // popovers/hour: CLI 호출 빈도
  signalIgnoreRate: number;            // 0–1: 신호 무시율
  consecutiveSessions: number;         // 연속 세션 수
  maxSessionLengthMin: number;         // 최장 세션 길이 (분)
}
```

**출력 파라미터 (4개)**:
```typescript
interface AdaptiveParams {
  signalFrequencyMultiplier: number;   // 0.5–1.5
  signalIntensityLevel: 1 | 2 | 3;    // 1: icon only / 2: icon+badge / 3: icon+badge+sound
  quietModeThreshold: number;          // 연속 무시 N회
  contextDetailLevel: 'brief' | 'normal' | 'detailed';
  supportiveSilenceMode: boolean;      // 지지적 침묵 모드
  hyperfocusAlert: boolean;            // 과집중 알림 활성화
}
```

**보수적 기본값** (기준선 기간 & 적응 전):
```typescript
const CONSERVATIVE_DEFAULTS: AdaptiveParams = {
  signalFrequencyMultiplier: 1.0,
  signalIntensityLevel: 2,
  quietModeThreshold: 3,
  contextDetailLevel: 'normal',
  supportiveSilenceMode: false,
  hyperfocusAlert: false,
};
```

**규칙 (임계값 기반, ML 아님)**:
```
IF 신호_무시율 > 60%           THEN 신호_빈도_승수 = 0.5
IF 세션_활동_비율 < 30%
   AND 시간 > 60분             THEN 지지적_침묵_모드 = true (icon only)
IF CLI_호출 > 5회/10분          THEN 통계_숨김 + prompt_최소화
IF 타이머_완료율 > 80%          THEN 신호_강도 = 1 (이미 자기조절 잘 됨)
IF 연속_세션 >= 3
   AND 세션길이 > 30분          THEN 과집중_알림_활성화
```

**기준선 기간 (첫 7일) UX**:
- 모든 신호는 보수적 기본값으로 동작
- "패턴을 배우고 있어요" 같은 안내 없음 (감시 느낌 방지)
- 사용자 경험은 정적(static) 모드와 동일
- 적응형 파라미터 변경은 하루 최대 1회 (매일 자정)

### 윤리적 경계 (하드코딩 — 설정으로 변경 불가)

| 절대 하지 않는 것 | 이유 | 코드 위치 |
|------------------|------|----------|
| 하락 지표 강조 표시 | RSD 유발 | dopamine-service.ts L7-13 |
| "스트릭 N일" 표시 | 끊어졌을 때 죄책감 | 하드코딩 주석 |
| 오늘 vs 어제 비교 (자동) | 나쁜 날에 자기비하 | 비교 기능 미구현 |
| "X분 낭비" 표현 | 판단적 | 하드코딩 주석 |
| 신호 부재를 통한 무언의 벌 | 부정적 강화 | signal-emitter.ts 조용모드 |
| 비활성 시간 표시 ("N분 이탈") | 죄책감 유발 | describeActivity()에서 제외 |
| 신호 빈도의 급격한 변화 | 조작당하는 느낌 | 0.5x–1.5x 범위 제한 |

---

## 4. Technical Architecture

### 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| Language | TypeScript (ES2022, ESM) | Claude Code 생태계 동일 런타임, npm 배포 용이 |
| Runtime | Node.js >=20 | ESM 네이티브 지원, fs/path/os 내장 |
| CLI Framework | `commander` ^13 + `chalk` ^5 | 경량, 서브커맨드 파싱 |
| TUI | Raw ANSI escape sequences | ink 대비 의존성 제거, halfblock 픽셀 아트 직접 제어 |
| Build | `tsup` ^8 (2 entry point) | 빠른 번들링, shebang 자동 삽입 |
| Test | `vitest` ^2 | 빠른 실행, ESM 네이티브 |
| File Watch | `chokidar` ^4 | FSEvents/inotify 크로스 플랫폼 래퍼 |
| Notification | `node-notifier` ^10 | macOS/Linux 크로스 플랫폼 |
| Data Storage | JSON 파일 기반 | sql.js WASM 대비 설치 복잡성 제거. 데이터량 극소 |
| Hook Scripts | Shell (bash) | Node.js cold-start (~300ms) 회피 → ~5ms |
| Sprite Gen | Python + PIL/numpy | PNG 스프라이트 분할 및 ANSI 아트 변환 |

### 아키텍처 다이어그램

```
┌───────────────────────────────────────────────────────────────────┐
│                      User Interfaces                              │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────┐ ┌─────────────┐ │
│  │  CLI Client   │ │ TUI Dashboard│ │ Shell     │ │ Claude Code │ │
│  │  (adhd ...)   │ │ (adhd dash)  │ │ Prompt    │ │ Hooks       │ │
│  │               │ │              │ │ Integration│ │ (shell      │ │
│  │  16 commands  │ │ Raw ANSI +   │ │           │ │  scripts)   │ │
│  │  commander.js │ │ chalk +      │ │ PS1/RPROMPT│ │             │ │
│  │               │ │ halfblock art│ │ tmux bar  │ │ → socket    │ │
│  │  status       │ │              │ │ term title│ │   message   │ │
│  │  where        │ │ Crawfish Art │ │           │ │             │ │
│  │  timer        │ │ Pixel Anim   │ │           │ │             │ │
│  │  dash         │ │ Token Viz    │ │           │ │             │ │
│  │  go           │ │ Activity NLP │ │           │ │             │ │
│  └──────┬───────┘ └──────┬───────┘ └─────┬─────┘ └──────┬──────┘ │
│         │                │               │               │        │
│  ┌──────┴────────────────┴───────────────┴───────────────┴─────┐  │
│  │              IPC Layer (Unix Socket)                         │  │
│  │         ~/.adhd-dev/adhd-dev.sock                           │  │
│  └──────────────────────┬──────────────────────────────────────┘  │
│                          │                                        │
│  ┌───────────────────────┴──────────────────────────────────────┐ │
│  │                     Daemon Process                            │ │
│  │  Tick: 10초 간격                                               │ │
│  │                                                               │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │ │
│  │  │ Agent        │ │ Timer        │ │ DopamineService      │  │ │
│  │  │ Tracker      │ │ Engine       │ │                      │  │ │
│  │  │              │ │              │ │ AdaptiveEngine       │  │ │
│  │  │ - discover   │ │ - flexible   │ │ SignalEmitter        │  │ │
│  │  │   (PID→      │ │   intervals  │ │ (prompt, bell,      │  │ │
│  │  │   sessionId  │ │ - presets    │ │  tmux, notification) │  │ │
│  │  │   → .jsonl)  │ │ - flow      │ │                      │  │ │
│  │  │ - token count│ │   protect    │ │ Ethical boundaries   │  │ │
│  │  │ - decay calc │ │ - hyperfocus │ │ (hardcoded)          │  │ │
│  │  │ - leveling   │ │   detect     │ │                      │  │ │
│  │  └──────┬───────┘ └──────────────┘ └──────────┬───────────┘  │ │
│  │         │                                     │               │ │
│  │  ┌──────┴─────────────────────────────────────┴────────────┐  │ │
│  │  │  JSON Files + File Watchers + Prompt State              │  │ │
│  │  │  ~/.adhd-dev/config.json       (사용자 설정)             │  │ │
│  │  │  ~/.adhd-dev/timer-state.json  (타이머 상태)             │  │ │
│  │  │  ~/.adhd-dev/prompt-state.json (shell prompt용 상태)     │  │ │
│  │  │  ~/.adhd-dev/baseline.json     (AdaptiveEngine 기준선)   │  │ │
│  │  │  ~/.adhd-dev/events.jsonl      (이벤트 로그)             │  │ │
│  │  │  ~/.adhd-dev/stats/YYYY-MM-DD.json (일일 통계)           │  │ │
│  │  │  ~/.adhd-dev/logs/             (에러/디버그 로그)         │  │ │
│  │  └──────────────────────┬─────────────────────────────────┘  │ │
│  └──────────────────────────┼────────────────────────────────────┘ │
│                             │                                     │
└─────────────────────────────┼─────────────────────────────────────┘
                              │
                    ┌─────────┴──────────────┐
                    │ ~/.claude/              │
                    │   sessions/             │
                    │     PID.json            │
                    │   projects/             │
                    │     -encoded-path/      │
                    │       UUID.jsonl        │
                    └────────────────────────┘
```

### Claude Code 세션 디스커버리 알고리즘

**실제 파일 구조**:
```
~/.claude/
  sessions/
    PID.json          # {"pid": 37899, "sessionId": "UUID", "cwd": "/path/to/project", "startedAt": 1774265396149}
  projects/
    -Users-path-encoded/     # cwd를 path-encode한 디렉토리명
      UUID.jsonl              # 세션 트랜스크립트
```

**Path Encoding 로직** (`path-encoder.ts`):
```typescript
// 1차 규칙: '/' 와 '.' 문자를 '-'로 치환
export function encodePath(fsPath: string): string {
  return fsPath.replace(/[/.]/g, '-');
}
// 예: '/Users/hona.mind/Dev/playground/adhd-dev'
//   → '-Users-hona-mind-Dev-playground-adhd-dev'

// 2차 Fallback: 디렉토리 스캔으로 fuzzy match
export function findProjectDir(fsPath: string): string | null {
  // 1차: exact match
  const encoded = encodePath(fsPath);
  const exact = `${CLAUDE_PROJECTS_DIR}/${encoded}`;
  if (existsSync(exact)) return exact;

  // 2차: 마지막 3세그먼트, 2세그먼트로 fuzzy match
  const segments = fsPath.split('/').filter(Boolean);
  for (const segCount of [3, 2]) {
    const suffix = segments.slice(-segCount).join('-').replace(/\./g, '-');
    const match = entries.find(e => e.endsWith(`-${suffix}`) || e.endsWith(suffix));
    if (match) return `${CLAUDE_PROJECTS_DIR}/${match}`;
  }
  return null;
}
```

**디스커버리 조인 알고리즘** (`agent-tracker.ts`):
```
1. ~/.claude/sessions/*.json 스캔
   → 각 PID.json에서 {pid, sessionId, cwd, startedAt} 추출

2. 각 세션에 대해:
   a. cwd를 path-encode → ~/.claude/projects/{encoded-cwd}/
   b. 해당 디렉토리에서 {sessionId}.jsonl 파일 탐색
   c. .jsonl 파일의 mtime으로 마지막 활동 시간 결정

3. 세션 상태 결정:
   - "working": .jsonl 최근 수정 ≤ 2분 이내
   - "idle": .jsonl 수정 2분 ~ 15분
   - "sleeping": .jsonl 수정 > 15분 또는 프로세스 종료

4. 토큰 카운팅:
   - .jsonl 파일 전체 라인 파싱
   - message.usage.input_tokens + output_tokens 합산
   - cache_creation/read_tokens 제외 (시스템 최적화, 사용자 작업 아님)

5. Decay 적용 (표시용):
   - effective_tokens = raw_tokens × (1 - rate)^hours
   - idle: rate = 0.02/h, sleeping: rate = 0.05/h

6. 레벨 계산:
   - LEVEL_THRESHOLDS = [0, 1000, 10000, 50000, 200000]
```

**세션 상태 머신**:
```
                   ┌─────────┐
  .jsonl 변경    → │ working │ ← .jsonl 변경 (≤2분)
  (≤2분 이내)      └────┬────┘
                        │ .jsonl 2분~15분 미변경
                        v
                   ┌─────────┐
                   │  idle   │
                   └────┬────┘
                        │ .jsonl 15분+ 미변경
                        v
                   ┌──────────┐
                   │ sleeping │
                   └──────────┘
```

**JSONL 파서** (`claude-session-parser.ts`):
```typescript
// Real Claude JSONL format:
// { "type": "assistant", "message": { "role": "assistant", "content": [...], "usage": {...} } }

// content 추출: obj.message.content ?? obj.content (fallback)
// role 판정: obj.type || obj.role || obj.message.role (3곳 체크)
// assistant 메시지만 필터링 → lastExchange로 사용
```

---

## 5. 가재 진화 게이미피케이션 시스템

### 5.1 레벨 체계

| Lv | 이름 | 토큰 임계값 | 색상 | HEX | 스프라이트 크기 |
|----|------|-----------|------|-----|--------------|
| 1 | Baby | 0 | gray | #888, #aaa, #666 | compact 30w, hires 80w |
| 2 | Juvenile | 1,000 | cyan | #00bcd4, #26c6da | compact 30w, hires 80w |
| 3 | Adult | 10,000 | green | #4caf50, #66bb6a | compact 40w, hires 100w |
| 4 | Warrior | 50,000 | yellow | #ffc107 | compact 40w, hires 100w |
| 5 | King | 200,000 | red | #ff1744 | compact 40w, hires 100w |

### 5.2 스프라이트 생성 파이프라인

```
[원본 스프라이트 시트 PNG (1408×768)]
        │
        ▼ (Python PIL)
[밀도 분석으로 5행 × 4열 영역 자동 감지]
        │
        ▼ (crop + 투명 배경 처리)
[20개 개별 PNG: {stage}_{state}.png]
  assets/crayfish/
        │
        ▼ (4프레임 픽셀 왜곡 적용)
[80개 왜곡 프레임 (20 sprites × 4 frames)]
        │
        ├──▼ halfblock 렌더링 (▀▄ + truecolor)
        │  [COMPACT: 30-40w 그리드 카드용]
        │
        └──▼ ASCII 밀도 렌더링 (' .·:;+x%#@█' + truecolor)
           [HIRES: 80-100w 상세 뷰용]
        │
        ▼ (TypeScript 코드 생성)
[crawfish-art.ts: 4338줄, 자동 생성]
  - COMPACT: Record<number, FrameMap>  // level → state → frames[] → lines[]
  - HIRES: Record<number, FrameMap>
  - getCrawfishArt(level, state, frame): string[]
  - getCrawfishHires(level, state, frame): string[]
```

### 5.3 픽셀 애니메이션 왜곡 방식

각 상태별 4프레임, `phase = (frame / NUM_FRAMES) * 2π`:

**idle — 더듬이/집게 흔들림**:
```python
# 수직 wave: 상단 픽셀이 더 크게 흔들림
for y in range(h):
    weight = max(0, 1.0 - y / h)  # 1.0 at top → 0.0 at bottom
    dx = int(sin(phase + y * 0.15) * 2 * weight)
    for x in range(w):
        sx = x - dx
        if 0 <= sx < w:
            result[y, x] = arr[y, sx]
```

**working — 활발한 움직임**:
```python
# 수평 wave + 수직 bounce
bounce_dy = int(sin(phase) * 2)
for y in range(h):
    amp = 1.5 + sin(y * 0.2) * 0.5
    dx = int(sin(phase + y * 0.25) * amp)
    sy = y - bounce_dy
    for x in range(w):
        sx = x - dx
        if 0 <= sx < w and 0 <= sy < h:
            result[y, x] = arr[sy, sx]
```

**complete — 두근두근 pulse**:
```python
# 중심에서 확대/축소
scale = 1.0 + sin(phase) * 0.04  # ±4% scale
cy, cx = h / 2, w / 2
for y in range(h):
    for x in range(w):
        sy = int(cy + (y - cy) / scale)
        sx = int(cx + (x - cx) / scale)
        if 0 <= sy < h and 0 <= sx < w:
            result[y, x] = arr[sy, sx]
```

**sleeping — 호흡 효과**:
```python
# 하단에서 수직 scale (배 부풀림) + 수평 sway
breath = 1.0 + sin(phase) * 0.03  # ±3%
for y in range(h):
    sy = int(h - (h - y) * breath)
    dx = int(sin(phase * 0.5 + y * 0.05) * 1)
    for x in range(w):
        sx = x - dx
        if 0 <= sy < h and 0 <= sx < w:
            result[y, x] = arr[sy, sx]
```

### 5.4 Halfblock 렌더링 알고리즘

```python
# 한 문자로 2픽셀 표현 (상단 = foreground ▀, 하단 = background)
for y in range(0, height, 2):
    for x in range(width):
        top = arr[y, x]       # RGBA
        bot = arr[y+1, x]     # RGBA
        top_visible = top[3] > 128
        bot_visible = bot[3] > 128

        if top_visible and bot_visible:
            # fg=top, bg=bot, char=▀
            f'\x1b[38;2;{top[0]};{top[1]};{top[2]}m'
            f'\x1b[48;2;{bot[0]};{bot[1]};{bot[2]}m▀\x1b[0m'
        elif top_visible:
            f'\x1b[38;2;{top[0]};{top[1]};{top[2]}m▀\x1b[0m'
        elif bot_visible:
            f'\x1b[38;2;{bot[0]};{bot[1]};{bot[2]}m▄\x1b[0m'
        else:
            ' '  # transparent
```

### 5.5 런타임 추가 효과

```typescript
// complete 상태: 반짝이 파티클
const SPARKLES = ['✨', '·', '★', '⭐', '✦', '•', '∗'];
// 아트 위/아래에 프레임마다 다른 위치에 반짝이 추가

// sleeping 상태: zZZ 텍스트 애니메이션
const ZZZ_FRAMES = ['  z', ' zZ', 'zZZ', ' zZ'];
// 아트 최상단 컨텐츠 라인에 dim zZZ 추가
```

---

## 6. 토큰 Decay 시스템

### 6.1 감소 공식

```typescript
// 지수 감소: tokens × (1 - rate)^hours
// 표시용만 — 실제 JSONL 데이터 불변
function applyTokenDecay(tokens: number, state: AgentState, inactiveMs: number): number {
  if (state === 'working' || state === 'complete') return tokens;
  if (inactiveMs <= 0 || tokens <= 0) return tokens;

  const hours = inactiveMs / (60 * 60 * 1000);
  const rate = state === 'sleeping'
    ? DECAY_RATE_SLEEPING   // 0.05 (5%/h)
    : DECAY_RATE_IDLE;      // 0.02 (2%/h)

  const decayed = tokens * Math.pow(1 - rate, hours);
  return Math.max(0, Math.floor(decayed));
}
```

| 상태 | Decay 속도 | 반감기 | 24h 후 잔존율 |
|------|-----------|--------|-------------|
| working | 없음 | ∞ | 100% |
| idle | 2%/h | ~35h | ~62% |
| sleeping | 5%/h | ~14h | ~29% |

### 6.2 Delta 추적 및 표시

```typescript
// dashboard.ts: 이전 토큰과 비교
const previousTokens = new Map<string, number>();

function getTokenDelta(agent: AgentInfo): number {
  const prev = previousTokens.get(agent.sessionId);
  if (prev === undefined) return 0;
  return agent.tokenUsage - prev;
}

// token-viz.ts: 렌더링
if (delta > 100)  → chalk.green(` +${formatTokenCount(delta)}↑`)
if (delta < -100) → chalk.red(` ${formatTokenCount(delta)}↓`)
```

### 6.3 AgentInfo 타입

```typescript
interface AgentInfo {
  tokenUsage: number;       // decay 적용 후 (표시용, 레벨 계산용)
  rawTokenUsage: number;    // decay 적용 전 (원본)
  // ... 기타 필드
}
```

---

## 7. TUI 대시보드 구현

### 7.1 ANSI Escape Sequences

```typescript
const ENTER_ALT_SCREEN = '\x1b[?1049h';  // 대시보드 진입 시 새 화면
const EXIT_ALT_SCREEN = '\x1b[?1049l';   // 종료 시 원래 화면 복원
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const MOVE_HOME = '\x1b[H';              // 커서를 (0,0)으로
const CLEAR_SCREEN = '\x1b[2J';
```

### 7.2 CJK 문자 폭 처리

한글/일본어/중국어는 터미널에서 2칸 차지하지만 `.length`는 1로 셈.

```typescript
function charWidth(code: number): number {
  if (
    (code >= 0x1100 && code <= 0x115F) ||  // Hangul Jamo
    (code >= 0x2E80 && code <= 0x303E) ||  // CJK Radicals
    (code >= 0x3040 && code <= 0x33BF) ||  // Hiragana, Katakana
    (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
    (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified
    (code >= 0xAC00 && code <= 0xD7AF) ||  // Hangul Syllables ★
    (code >= 0xF900 && code <= 0xFAFF) ||  // CJK Compat
    (code >= 0xFE30 && code <= 0xFE6F) ||  // CJK Compat Forms
    (code >= 0xFF01 && code <= 0xFF60) ||  // Fullwidth Forms
    (code >= 0xFFE0 && code <= 0xFFE6) ||  // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2FA1F)   // CJK Extensions
  ) return 2;
  return 1;
}

function stripAnsi(str: string): number {
  return displayWidth(str.replace(/\x1b\[[0-9;]*m/g, ''));
}
```

### 7.3 동적 카드 크기

```typescript
function getCardDimensions(): { inner: number; outer: number } {
  const cols = process.stdout.columns ?? 120;
  const twoCol = cols >= 90;
  // 2-column: total = 2*outer + 4 (gap+borders) ≤ cols-2
  const inner = twoCol
    ? Math.floor((cols - 6) / 2) - 2
    : cols - 6;
  const clamped = Math.max(28, Math.min(inner, 60));
  return { inner: clamped, outer: clamped + 2 };
}
// 매 렌더마다 재계산 → 터미널 리사이즈 대응
```

### 7.4 자연어 활동 표시

```typescript
function describeActivity(agent: AgentInfo): string {
  if (agent.state === 'sleeping') return '휴식 중...';
  if (agent.state === 'idle') return '대기 중...';     // idle은 항상 고정 텍스트
  if (agent.state === 'complete') return '작업 완료!';
  // working: Claude의 마지막 assistant 응답에서 추출
  return summarizeExchange(agent.lastExchange, CARD_INNER_WIDTH - 4);
}

function summarizeExchange(text: string, maxLen: number): string {
  // 1. 의미 있는 첫 줄 추출 (markdown, code fence, 테이블 행 건너뜀)
  // 2. markdown 포맷 제거: **, `, |
  // 3. CJK display width 기준으로 잘라내기
  let w = 0;
  for (let i = 0; i < summary.length; i++) {
    const cw = charWidth(summary.codePointAt(i)!);
    if (w + cw > maxLen - 1) {  // -1 for '…'
      return summary.slice(0, i) + '…';
    }
    w += cw;
  }
  return summary;
}
```

### 7.5 그리드 뷰 레이아웃

```
┌─────────── 🦞 ADHD-Dev Agent Dashboard ───────────┐
│ Dopamine: PM | warm              Timer: 18:42 ██░ 52% │
│──────────────────────────────────────────────────────│
│                                                      │
│ ┌── adhd-dev ──────1┐  ┌── d0po.mind ─────2┐       │
│ │                    │  │                    │       │
│ │   [가재 픽셀 아트]  │  │   [가재 픽셀 아트]  │       │
│ │   (4프레임 애니메)  │  │   (idle 상태)      │       │
│ │                    │  │                    │       │
│ │ Lv3 Adult ████ 44K │  │ Lv2 Juv  ██ 5.3K  │       │
│ │ ● 빌드 성공.       │  │ ◐ 대기 중...       │       │
│ └────────────────────┘  └────────────────────┘       │
│                                                      │
│ Today: 45m focused | 3 sessions | Total: 68.6K       │
│ [q]uit [r]efresh [t]imer [1-5]agent detail           │
└──────────────────────────────────────────────────────┘
```

### 7.6 상세 뷰

```
┌── adhd-dev (Detail) ─────────────────────────┐
│                                               │
│         [HIRES 가재 아트 (80-100w)]            │
│         (큰 사이즈 픽셀 아트)                   │
│                                               │
│  Lv3 Adult ██████████░░ 44.9K/50.0K +1.2K↑   │
│  ● 빌드 확인하겠습니다. [crawfish-art.ts]       │
│  도구: Read → Edit → Bash → Read → Edit       │
│                                               │
│  Last active: 2m ago                          │
│  Started: 1h 23m ago                          │
│                                               │
│  ─────── Token Histogram ───────              │
│  adhd-dev   ████████████████████  44.9K       │
│                                               │
│  ─────── Last Exchange ───────                │
│  빌드 성공. 이제 활동 설명이 CARD_INNER_WIDTH   │
│  - 4자 이내로 잘리고, 마크다운 포맷도 제거...    │
│                                               │
│ [b]ack [q]uit                                 │
└───────────────────────────────────────────────┘
```

### 7.7 키보드 조작

```typescript
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

// 키 핸들링
switch (str) {
  case 'q':
  case '\x03':  // Ctrl-C
    cleanup(); process.exit(0); break;
  case 'r':     // 수동 새로고침
    refresh(); break;
  case 't':     // 타이머 토글
    toggleTimer(); break;
  case '1'-'5': // 에이전트 상세 뷰
    showDetail(index); break;
  case 'b':
  case '\x1b':  // Esc → 그리드 복귀
    backToGrid(); break;
}
```

### 7.8 렌더링 루프

```typescript
let renderFrame = 0;

async function refresh(): Promise<void> {
  const [agents, timer, stats, promptState] = await Promise.all([
    discoverAgents(),
    getTimerStatus(),
    getTodayStats(),
    readPromptState(),
  ]);
  trackLevelUps(agents);     // 레벨업 플래시 감지
  renderFrame++;             // 애니메이션 프레임 증가
  renderDashboard(agents, timer, stats, promptState);
  decrementFlash();          // 플래시 카운터 감소
}

// 2초 자동 새로고침
setInterval(() => void refresh(), 2000);
```

---

## 8. CLI 명령어 (16개)

### 8.1 명령어 목록

```bash
# 상태 조회
adhd-dev status              # 활성/유휴 세션 수 + 목록
adhd-dev where [--brief]     # "어디까지 했더라?" 컨텍스트
adhd-dev today               # 오늘의 집중 통계

# 대시보드
adhd-dev dash                # TUI 대시보드 (인터랙티브)

# 타이머
adhd-dev timer start [min]   # 집중 타이머 시작 (기본 25분)
adhd-dev timer stop          # 타이머 중지
adhd-dev timer status        # 남은 시간 확인
adhd-dev timer preset <name> # 프리셋 (pomodoro/desktime/ultradian)

# 네비게이션
adhd-dev go <session>        # 세션 디렉토리로 이동 (shell eval)

# 모드
adhd-dev flow <on|off>       # 방해금지 모드

# 설치/관리
adhd-dev init [--full]       # 설치 위자드
adhd-dev doctor              # 설치 상태 진단
adhd-dev config              # 설정 조회/변경
adhd-dev daemon <start|stop|status> # 데몬 관리
adhd-dev install-hooks       # Claude Code hooks 설치
adhd-dev uninstall-hooks     # hooks 제거
adhd-dev reset [--force]     # 모든 데이터 삭제
```

### 8.2 타이머 프리셋

```typescript
const PRESETS = {
  pomodoro:  { focus: 25, break: 5 },
  desktime:  { focus: 52, break: 17 },
  ultradian: { focus: 90, break: 20 },
};
```

### 8.3 `go` 명령어 구현 (shell wrapper 필요)

Node.js subprocess는 parent shell의 cwd를 변경할 수 없으므로 shell function wrapper 사용:

```bash
# ~/.zshrc 또는 ~/.bashrc에 설치 (adhd init --full)
adhd() { eval "$(command adhd-dev "$@")"; }
```

`go` subcommand 시 stdout으로 `cd /path` 출력 → wrapper가 eval.

---

## 9. Daemon 아키텍처

### 9.1 메인 루프 (`daemon/index.ts`)

```typescript
const TICK_INTERVAL_MS = 10_000; // 10초

async function main(): Promise<void> {
  ensureHomeDir();
  writePidFile();
  loadConfig();
  await startIpcServer();
  await startWatching();

  // 10초 tick 루프
  tickInterval = setInterval(async () => {
    tick();  // DopamineService tick (타이머 상태 갱신)

    // 일일 데이터 정리 (자정 1회)
    const now = Date.now();
    if (now - lastPurgeAt > 24 * 60 * 60 * 1000) {
      purgeOldData();
      purgeEventLog();
      lastPurgeAt = now;
    }
  }, TICK_INTERVAL_MS);
}

// 시그널 핸들링
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function shutdown(signal: string): Promise<void> {
  clearInterval(tickInterval);
  await stopWatching();
  await stopIpcServer();
  removePidFile();
  process.exit(0);
}
```

### 9.2 IPC 서버 (`daemon/ipc-server.ts`)

- Unix domain socket: `~/.adhd-dev/adhd-dev.sock`
- JSON-RPC 프로토콜
- CLI → daemon 명령 전송, daemon → CLI 상태 응답

### 9.3 파일 감시 (`daemon/file-watcher.ts`)

- chokidar로 `~/.claude/sessions/`와 `~/.claude/projects/` 감시
- 새 .json/.jsonl 파일 생성 → 세션 이벤트 발생
- .jsonl 변경 → activity 이벤트 발생

---

## 10. Hook 스크립트

### 10.1 Hook 등록 (`hook-installer.ts`)

```typescript
const HOOK_SCRIPTS = [
  { file: 'session-start.sh', event: 'SessionStart' },
  { file: 'session-stop.sh',  event: 'Stop' },
  { file: 'notification.sh',  event: 'Notification' },
];
```

Claude Code settings.json에 hook 등록:
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "~/.adhd-dev/hooks/session-start.sh" }]
    }]
  }
}
```

### 10.2 Hook 스크립트 예시

```bash
#!/bin/bash
# session-start.sh — Claude Code SessionStart hook
# daemon에 세션 시작 알림 (Unix socket, ~5ms)
SOCK="$HOME/.adhd-dev/adhd-dev.sock"
if [ -S "$SOCK" ]; then
  echo '{"event":"session-start","ts":'$(date +%s)'}' | nc -U -w1 "$SOCK" 2>/dev/null
else
  # Fallback: 이벤트 로그에 직접 기록
  echo '{"event":"session-start","ts":'$(date +%s)'}' >> "$HOME/.adhd-dev/events.jsonl"
fi
```

### 10.3 설정 백업

```typescript
function rotateBackups(): void {
  // bak.2 → bak.3, bak.1 → bak.2, current → bak.1
  // 항상 3개 백업 유지
  for (let i = 2; i >= 1; i--) {
    copyFileSync(`${CLAUDE_SETTINGS}.bak.${i}`, `${CLAUDE_SETTINGS}.bak.${i + 1}`);
  }
  copyFileSync(CLAUDE_SETTINGS, `${CLAUDE_SETTINGS}.bak.1`);
}
```

---

## 11. Shell Prompt 통합

### 11.1 Zsh (RPROMPT)

```bash
# ~/.zshrc에 추가 (adhd init --full이 자동 설정)
export RPROMPT='$(adhd-dev prompt-status 2>/dev/null)'
```

### 11.2 Bash (PS1)

```bash
# ~/.bashrc에 추가
export PS1='$(adhd-dev prompt-status 2>/dev/null)\$ '
```

### 11.3 Tmux Status Bar

```tmux
# ~/.tmux.conf에 추가
set -g status-right '#(adhd-dev tmux-status 2>/dev/null) | %H:%M'
set -g status-interval 5
```

### 11.4 prompt-status 동작

- `~/.adhd-dev/prompt-state.json` 파일 읽기만 수행 (socket 통신 없음)
- **성능 목표**: < 10ms
- daemon 미실행 시: 빈 문자열 (graceful degradation)
- 출력 예시: `[18:42 | *5]`, `[AM ~]`, `[← adhd-dev]`

---

## 12. 데이터 저장소

### 12.1 파일 경로 (`core/paths.ts`)

```typescript
const ADHD_DEV_HOME = '~/.adhd-dev';

// 설정 & 상태
ADHD_DEV_CONFIG       = ~/.adhd-dev/config.json
ADHD_DEV_TIMER_STATE  = ~/.adhd-dev/timer-state.json
ADHD_DEV_PROMPT_STATE = ~/.adhd-dev/prompt-state.json
ADHD_DEV_EVENTS_LOG   = ~/.adhd-dev/events.jsonl
ADHD_DEV_PATH_CACHE   = ~/.adhd-dev/path-encoding-cache.json

// 데몬
ADHD_DEV_PID_FILE     = ~/.adhd-dev/adhd-dev.pid
ADHD_DEV_SOCKET       = ~/.adhd-dev/adhd-dev.sock

// 적응형 엔진
BASELINE_FILE         = ~/.adhd-dev/baseline.json

// 로그 & 통계
ADHD_DEV_LOG_DIR      = ~/.adhd-dev/logs/
ADHD_DEV_LOG_FILE     = ~/.adhd-dev/logs/adhd-dev.log
STATS_DIR             = ~/.adhd-dev/stats/
                        ~/.adhd-dev/stats/YYYY-MM-DD.json

// Claude Code
CLAUDE_HOME           = ~/.claude
CLAUDE_SESSIONS_DIR   = ~/.claude/sessions/
CLAUDE_PROJECTS_DIR   = ~/.claude/projects/
CLAUDE_SETTINGS       = ~/.claude/settings.json
```

### 12.2 파일 스키마

**config.json**:
```json
{
  "timer": {
    "defaultMinutes": 25,
    "breakMinutes": 5,
    "preset": "pomodoro"
  },
  "notification": {
    "sound": true,
    "systemNotification": true,
    "terminalBell": true
  },
  "dopamine": {
    "signalLevel": "on"
  },
  "data": {
    "retentionDays": 30
  },
  "daemon": {
    "autoStart": false
  }
}
```

**timer-state.json**:
```json
{
  "running": true,
  "startedAt": 1774265396149,
  "durationMs": 1500000,
  "preset": "pomodoro",
  "flowMode": false,
  "pausedAt": null
}
```

**prompt-state.json**:
```json
{
  "pulse": "*",
  "badge": 5,
  "timer": "18:42",
  "timeOfDay": "PM",
  "returnTo": "adhd-dev",
  "warmth": "warm",
  "updated": 1774265396149
}
```

**baseline.json**:
```json
{
  "startedAt": 1774265396149,
  "lastRecalcAt": 1774351796149,
  "days": [
    {
      "date": "2026-03-27",
      "productiveAppTimeRatio": 0.65,
      "sessionSwitchFrequency": 2.3,
      "timerCompletionRate": 0.8,
      "popoverFrequency": 1.5,
      "signalIgnoreRate": 0.2,
      "consecutiveSessions": 3,
      "maxSessionLengthMin": 45
    }
  ]
}
```

**stats/YYYY-MM-DD.json**:
```json
{
  "focusMinutes": 145,
  "completedSessions": 3,
  "date": "2026-03-27"
}
```

---

## 13. 빌드 & 배포

### 13.1 tsup 설정

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/cli',
    sourcemap: true,
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: ['src/daemon/index.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist/daemon',
    sourcemap: true,
  },
]);
```

### 13.2 package.json

```json
{
  "name": "adhd-dev",
  "version": "0.1.0",
  "type": "module",
  "bin": { "adhd-dev": "dist/cli/index.js" },
  "files": ["dist", "src/hooks"],
  "engines": { "node": ">=20.0.0" },
  "dependencies": {
    "chalk": "^5.3.0",
    "chokidar": "^4.0.0",
    "commander": "^13.0.0",
    "node-notifier": "^10.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-notifier": "^8.0.5",
    "tsup": "^8.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

---

## 14. 구현 순서 (Phase별)

### Phase 1: 기반 scaffolding (Day 1)
1. package.json, tsconfig.json, tsup.config.ts 생성
2. `core/paths.ts`: 모든 경로 상수 정의
3. `core/config.ts`: ~/.adhd-dev/ 생성 + config.json 기본값
4. `core/logger.ts`: 구조화 로깅 (error/warn/info/debug)
5. `models/types.ts`: 전체 인터페이스 정의

### Phase 2: 세션 디스커버리 (Day 2)
6. `services/path-encoder.ts`: encodePath + findProjectDir (fuzzy fallback)
7. `services/claude-session-discovery.ts`: PID.json → 세션 조인
8. `services/claude-session-parser.ts`: JSONL 파싱 (message.content fallback)
9. `services/agent-tracker.ts`: 토큰 카운팅 + 레벨 계산 + decay
10. CLI 명령어: status, where

### Phase 3: 타이머 & 통계 (Day 3)
11. `services/timer-engine.ts`: 상태머신 + 프리셋 + 영속화
12. `services/stats-aggregator.ts`: 일일 통계
13. `services/notification.ts`: bell + node-notifier
14. `services/flow-protection.ts`: DND 모드
15. CLI 명령어: timer, today, flow

### Phase 4: 스프라이트 시스템 (Day 4)
16. Python 스크립트: 스프라이트 시트 분할 → 20 PNG
17. Python 스크립트: 4프레임 왜곡 + halfblock/hires 변환
18. `tui/crawfish-art.ts`: 자동 생성 (4338줄)
19. `tui/token-viz.ts`: 레벨 프로그레스 + delta 표시
20. `tui/progress-bar.ts`: 범용 프로그레스 바

### Phase 5: TUI 대시보드 (Day 5-6)
21. `tui/dashboard.ts`: 그리드 뷰 + 카드 렌더링
22. 동적 카드 크기 계산 + CJK charWidth
23. 자연어 활동 표시 (summarizeExchange)
24. 상세 뷰 + 토큰 히스토그램
25. 키보드 핸들링 + 렌더링 루프 (2초 갱신)
26. 레벨업 플래시 + 토큰 delta 추적
27. CLI 명령어: dash

### Phase 6: 도파민 & 데몬 (Day 7)
28. `services/signal-emitter.ts`: 피보나치 뱃지 + 게이팅 규칙
29. `services/adaptive-engine.ts`: 7일 기준선 + 규칙 엔진
30. `services/dopamine-service.ts`: 이벤트 라우팅 + 윤리적 경계
31. `daemon/index.ts`: 10초 tick + PID 파일 + 시그널 핸들링
32. `daemon/ipc-server.ts`: Unix socket 서버
33. `daemon/file-watcher.ts`: chokidar 감시
34. `services/data-purger.ts`: 30일 정리
35. CLI 명령어: daemon

### Phase 7: 통합 & 마무리 (Day 8)
36. `services/hook-installer.ts`: settings.json 수정 + 3단 백업
37. `services/shell-integrator.ts`: zsh/bash prompt + wrapper
38. CLI 명령어: init, doctor, config, go, install-hooks, uninstall-hooks, reset
39. prompt-status, tmux-status 명령어
40. 전체 빌드 검증 + 타입체크 + 테스트
