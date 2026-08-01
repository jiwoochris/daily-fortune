# 🔮 오늘의 운세

버튼을 누르면 카드가 뒤집히며 랜덤 운세와 행운의 아이템이 나오는 Next.js 사이트입니다.

## 기능

- 3D 플립 카드 애니메이션으로 운세 공개
- 운세 메시지와 운세 지수 (게이지 바)
- 행운의 아이템 / 행운의 색 / 행운의 숫자 / 귀인의 초성
- "다시 뽑기"로 언제든 재추첨
- 운세 기록을 **Supabase**에 저장 (기기별 익명 ID로 구분, 미설정 시 localStorage 폴백)

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

create policy "anon_read"   on public.fortune_history for select to anon using (true);
create policy "anon_insert" on public.fortune_history for insert to anon with check (true);
create policy "anon_delete" on public.fortune_history for delete to anon using (true);
```

> 로그인이 없어 기기별 구분은 클라이언트 편의 기능이며, anon 키로는 누구나 전체 기록을 읽을 수 있습니다. 사용자별 실제 격리가 필요하면 Supabase Auth를 붙이세요.

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
