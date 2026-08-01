# 🔮 오늘의 운세

버튼을 누르면 카드가 뒤집히며 랜덤 운세와 행운의 아이템이 나오는 Next.js 사이트입니다.

## 기능

- 3D 플립 카드 애니메이션으로 운세 공개
- 운세 메시지와 운세 지수 (게이지 바)
- 행운의 아이템 / 행운의 색 / 행운의 숫자 / 귀인의 초성
- "다시 뽑기"로 언제든 재추첨
- **이메일 로그인**(Supabase Auth): 로그인 시 계정 기준으로 기록 저장(기기 간 공유), 로그아웃 시 기기별
- 운세 기록을 **Supabase**에 저장 (미설정 시 localStorage 폴백)

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
