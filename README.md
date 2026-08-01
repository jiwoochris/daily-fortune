# 🔮 오늘의 운세

버튼을 누르면 카드가 뒤집히며 랜덤 운세와 행운의 아이템이 나오는 Next.js 사이트입니다.

## 기능

- 3D 플립 카드 애니메이션으로 운세 공개
- 운세 메시지와 운세 지수 (게이지 바)
- 행운의 아이템 / 행운의 색 / 행운의 숫자 / 귀인의 초성
- "다시 뽑기"로 언제든 재추첨
- **이메일 로그인**(Supabase Auth): 로그인 시 계정 기준으로 기록 저장(기기 간 공유), 로그아웃 시 기기별
- 운세 기록을 **Supabase**에 저장 (미설정 시 localStorage 폴백)
- **✨ AI 운세**(OpenRouter): 버튼을 누르면 AI가 그때그때 새 운세를 생성 (서버 라우트에서 호출, 키는 서버 전용)
  - **생년월일**을 입력하면 별자리/띠/나이대를 반영해 개인화
  - 운세 내용에 **어울리는 이미지**를 AI가 함께 생성해 카드에 표시

운세 12종 × 아이템 15종 × 색상 8종 × 숫자(1–45) × 귀인의 초성 2개를 조합해 뽑습니다.

## 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## Supabase 연동 (선택)

운세 기록을 서버에 저장하려면 Supabase를 설정합니다. 값이 없으면 자동으로 localStorage에만 저장됩니다.

**1. 환경 변수** — 프로젝트 루트에 `.env.local` 생성 (커밋되지 않음):

```
NEXT_PUBLIC_SUPABASE_URL=https://<프로젝트ID>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable(anon) 키>
```

> ⚠️ 브라우저에 노출되는 **publishable(anon) 키만** 사용합니다. secret 키는 절대 넣지 마세요.

**2. 테이블** — Supabase 대시보드 → SQL Editor에서 실행:

```sql
create table if not exists public.fortune_history (
  id         bigint generated always as identity primary key,
  device_id  text        not null,
  drawn_at   timestamptz not null default now(),
  emoji      text,
  title      text        not null,
  score      int,
  item       text,
  created_at timestamptz not null default now()
);

create index if not exists fortune_history_device_idx
  on public.fortune_history (device_id, drawn_at desc);

alter table public.fortune_history enable row level security;

-- 로그인 사용자 소유 표시
alter table public.fortune_history
  add column if not exists user_id uuid references auth.users(id) default auth.uid();

alter table public.fortune_history enable row level security;

-- 로그아웃(anon): user_id 없는 기기별 익명 행만
create policy "anon_read"   on public.fortune_history for select to anon          using (user_id is null);
create policy "anon_insert" on public.fortune_history for insert to anon          with check (user_id is null);
create policy "anon_delete" on public.fortune_history for delete to anon          using (user_id is null);

-- 로그인(authenticated): 본인 행만 (실제 격리)
create policy "auth_read"   on public.fortune_history for select to authenticated using (auth.uid() = user_id);
create policy "auth_insert" on public.fortune_history for insert to authenticated with check (auth.uid() = user_id);
create policy "auth_delete" on public.fortune_history for delete to authenticated using (auth.uid() = user_id);
```

**3. 로그인 방식** — 이메일 + 비밀번호(Supabase Auth 기본)를 사용합니다. 가입 즉시 로그인되게 하려면 대시보드 **Authentication → Sign In / Providers → Email**에서 "Confirm email"을 끄세요. 로그인 시 기록은 계정에 저장되어 기기 간 공유되고, 로그아웃 시에는 기기별(device_id)로 저장됩니다.

## AI 운세 (OpenRouter, 선택)

"✨ AI 운세" 버튼은 [OpenRouter](https://openrouter.ai)로 운세를 생성합니다. 키는 **서버 라우트(`app/api/fortune`)에서만** 읽으며 브라우저로 노출되지 않습니다.

`.env`에 키를 넣으세요 (커밋되지 않음):

```
OPENROUTER_API_KEY=sk-or-v1-...
# (선택) 텍스트 모델 — 기본값: openai/gpt-4o-mini
# OPENROUTER_MODEL=openai/gpt-4o-mini
# (선택) 이미지 모델 — 기본값: google/gemini-2.5-flash-image
# OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image
```

> "✨ AI 운세"는 텍스트 생성 + 이미지 생성으로 **AI를 두 번 호출**하므로, 일반 "운세 뽑기"보다 느리고(약 8~12초) 비용이 더 듭니다. 생성된 이미지는 카드에만 표시하고 DB/기록에는 저장하지 않습니다(용량 문제). 생년월일은 브라우저(localStorage)와 AI 요청에만 쓰이며 서버에 저장되지 않습니다.

> ⚠️ OpenRouter 키는 과금되는 **비밀 키**입니다. `NEXT_PUBLIC_`을 붙이면 안 되고, 반드시 서버(`.env`)에만 두세요. 키가 없으면 "✨ AI 운세" 버튼은 에러를 표시하고, 일반 "운세 뽑기"는 그대로 동작합니다.

## 구조

| 파일 | 설명 |
| --- | --- |
| `app/page.js` | 카드 뒤집기 상태 관리, 운세 기록 저장/조회 (클라이언트 컴포넌트) |
| `app/fortunes.js` | 운세·아이템·색상 데이터와 `drawFortune()` 추첨 함수 |
| `app/supabaseClient.js` | Supabase 클라이언트 (환경 변수 없으면 비활성) |
| `app/globals.css` | 3D 플립 애니메이션 및 전체 스타일 |

## 스택

Next.js 15 (App Router) · React 19 · Supabase · CSS (라이브러리 없음)

---

재미로 보는 운세입니다 ✨
