"use client";

import { useEffect, useRef, useState } from "react";
import { drawFortune } from "./fortunes";
import { supabase, isSupabaseEnabled } from "./supabaseClient";

const FLIP_MS = 900;
const HISTORY_KEY = "fortune-history"; // localStorage 폴백용
const DEVICE_KEY = "fortune-device-id"; // 로그아웃 상태에서 기기별 익명 ID로 기록 구분
const BIRTH_KEY = "fortune-birthdate"; // 생년월일 (개인화용)
const HISTORY_MAX = 50; // 무한정 쌓이지 않도록 최근 50개만 보관
const TABLE = "fortune_history";

// Supabase 행 → 화면에서 쓰는 형태로 변환
const mapRow = (row) => ({
  id: row.id,
  at: new Date(row.drawn_at).getTime(),
  emoji: row.emoji,
  title: row.title,
  score: row.score,
  item: row.item,
});

export default function Home() {
  const [result, setResult] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scoreWidth, setScoreWidth] = useState(0);
  const [today, setToday] = useState("");
  const [history, setHistory] = useState([]);

  // 인증 상태
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // AI 운세 상태
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [birthdate, setBirthdate] = useState("");

  const timers = useRef([]);
  const deviceId = useRef(null);
  const userRef = useRef(null); // 콜백에서 최신 사용자 참조 (stale closure 방지)

  // 날짜는 클라이언트에서만 계산 (하이드레이션 불일치 방지)
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    );
  }, []);

  // 기기별 익명 ID 확보 (클라이언트에서만)
  useEffect(() => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    deviceId.current = id;

    const savedBirth = localStorage.getItem(BIRTH_KEY);
    if (savedBirth) setBirthdate(savedBirth);
  }, []);

  const handleBirthdate = (value) => {
    setBirthdate(value);
    try {
      if (value) localStorage.setItem(BIRTH_KEY, value);
      else localStorage.removeItem(BIRTH_KEY);
    } catch {
      // 무시
    }
  };

  // 인증 세션 초기화 + 변화 구독
  useEffect(() => {
    if (!isSupabaseEnabled) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      userRef.current = u;
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      userRef.current = u;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 인증 준비 완료 후, 로그인/로그아웃 상태에 맞는 기록 불러오기
  useEffect(() => {
    if (!authReady) return;

    if (!isSupabaseEnabled) {
      try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        if (Array.isArray(saved)) setHistory(saved);
      } catch {
        // 손상된 데이터는 무시
      }
      return;
    }

    let q = supabase
      .from(TABLE)
      .select("*")
      .order("drawn_at", { ascending: false })
      .limit(HISTORY_MAX);
    q = user
      ? q.eq("user_id", user.id)
      : q.eq("device_id", deviceId.current).is("user_id", null);

    q.then(({ data, error }) => {
      if (error) {
        console.error("[supabase] 기록 불러오기 실패:", error.message);
        return;
      }
      setHistory((data || []).map(mapRow));
    });
  }, [authReady, user]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const after = (ms, fn) => timers.current.push(setTimeout(fn, ms));

  const record = (drawn) => {
    const at = Date.now(); // 뽑은 시각 (epoch ms)
    const entry = {
      id: at, // 낙관적 렌더링용 임시 키 (Supabase 성공 시 실제 id로 교체)
      at,
      emoji: drawn.fortune.emoji,
      title: drawn.fortune.title,
      score: drawn.fortune.score,
      item: drawn.item,
    };

    // 화면에는 즉시 반영 (낙관적 업데이트)
    setHistory((prev) => [entry, ...prev].slice(0, HISTORY_MAX));

    if (isSupabaseEnabled) {
      const row = {
        device_id: deviceId.current,
        drawn_at: new Date(at).toISOString(),
        emoji: entry.emoji,
        title: entry.title,
        score: entry.score,
        item: entry.item,
      };
      if (userRef.current) row.user_id = userRef.current.id;

      supabase
        .from(TABLE)
        .insert(row)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("[supabase] 기록 저장 실패:", error.message);
            return;
          }
          if (data) {
            setHistory((prev) =>
              prev.map((h) => (h.id === at ? mapRow(data) : h))
            );
          }
        });
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        const nextList = [entry, ...saved].slice(0, HISTORY_MAX);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(nextList));
      } catch {
        // 저장 실패(용량 초과 등)해도 화면 표시는 계속
      }
    }
  };

  const clearHistory = () => {
    setHistory([]);
    if (isSupabaseEnabled) {
      let del = supabase.from(TABLE).delete();
      del = userRef.current
        ? del.eq("user_id", userRef.current.id)
        : del.eq("device_id", deviceId.current).is("user_id", null);
      del.then(({ error }) => {
        if (error) console.error("[supabase] 기록 삭제 실패:", error.message);
      });
    } else {
      try {
        localStorage.removeItem(HISTORY_KEY);
      } catch {
        // 무시
      }
    }
  };

  const revealWith = (next) => {
    setResult(next);
    setScoreWidth(0);
    setFlipped(true);
    record(next);
    after(60, () => setScoreWidth(next.fortune.score));
    after(FLIP_MS, () => setBusy(false));
  };

  const reveal = () => revealWith(drawFortune());

  const handleDraw = () => {
    if (busy || aiLoading) return;
    setBusy(true);

    if (!flipped) {
      reveal();
      return;
    }

    // 이미 뒤집혀 있으면 되돌린 뒤 새 운세로 다시 뒤집는다
    setFlipped(false);
    after(FLIP_MS + 200, reveal);
  };

  // OpenRouter로 AI가 생성한 운세 뽑기
  const handleDrawAI = async () => {
    if (busy || aiLoading) return;
    setBusy(true);
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthdate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);

      // 이미 뒤집혀 있으면 되돌린 뒤 새 운세로 다시 뒤집는다
      if (flipped) {
        setFlipped(false);
        await new Promise((r) => setTimeout(r, FLIP_MS + 200));
      }
      setAiLoading(false);
      revealWith(data);
    } catch (e) {
      setAiLoading(false);
      setBusy(false);
      setAiError(e.message || "AI 운세 생성에 실패했어요.");
    }
  };

  // ── 인증 액션 ──────────────────────────────
  const handleSignIn = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setAuthMsg(`로그인 실패: ${error.message}`);
    else setPassword("");
    setAuthBusy(false);
  };

  const handleSignUp = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthMsg("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      setAuthMsg(`회원가입 실패: ${error.message}`);
    } else if (!data.session) {
      // 이메일 확인이 켜져 있으면 세션이 없다 → 확인 메일 안내
      setAuthMsg("확인 이메일을 보냈어요. 메일의 링크를 눌러 인증해 주세요.");
    } else {
      setAuthMsg("");
      setPassword("");
    }
    setAuthBusy(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthMsg("");
  };

  return (
    <main className="page">
      <div className="stars" aria-hidden="true" />

      {isSupabaseEnabled && authReady && (
        <div className="authbar">
          {user ? (
            <>
              <span className="auth-who">🙂 {user.email}</span>
              <button className="auth-btn ghost" onClick={handleSignOut}>
                로그아웃
              </button>
            </>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSignIn();
              }}
            >
              <input
                className="auth-input"
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <input
                className="auth-input"
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button className="auth-btn" type="submit" disabled={authBusy}>
                로그인
              </button>
              <button
                className="auth-btn ghost"
                type="button"
                onClick={handleSignUp}
                disabled={authBusy}
              >
                회원가입
              </button>
            </form>
          )}
        </div>
      )}
      {authMsg && <p className="auth-msg">{authMsg}</p>}

      <header className="header">
        <p className="eyebrow">Today&apos;s Fortune</p>
        <h1 className="title">오늘의 운세</h1>
        <p className="date">{today || " "}</p>
      </header>

      <div className="card-scene">
        <div className={`card${flipped ? " flipped" : ""}`}>
          {/* 뒷면 */}
          <div className="face back">
            <div className="back-sigil">🔮</div>
            <p className="back-label">TAP TO REVEAL</p>
          </div>

          {/* 앞면 */}
          <div className="face front" aria-live="polite">
            {result && (
              <>
                {result.ai && <div className="ai-badge">✨ AI가 지은 운세</div>}
                {result.image ? (
                  <img
                    className="fortune-img"
                    src={result.image}
                    alt={result.fortune.title}
                  />
                ) : (
                  <div className="front-emoji">{result.fortune.emoji}</div>
                )}
                <h2 className="front-title">{result.fortune.title}</h2>
                <p className="front-message">{result.fortune.message}</p>

                <div className="score">
                  <div className="score-head">
                    <span>오늘의 운세 지수</span>
                    <span>{result.fortune.score}점</span>
                  </div>
                  <div className="score-bar">
                    <div
                      className="score-fill"
                      style={{ width: `${scoreWidth}%` }}
                    />
                  </div>
                </div>

                <div className="divider" />

                <div className="lucky">
                  <div className="lucky-row">
                    <span className="lucky-key">🎒 행운의 아이템</span>
                    <span className="lucky-val">{result.item}</span>
                  </div>
                  <div className="lucky-row">
                    <span className="lucky-key">🎨 행운의 색</span>
                    <span className="lucky-val">
                      <span
                        className="swatch"
                        style={{ background: result.color.hex }}
                      />
                      {result.color.name}
                    </span>
                  </div>
                  <div className="lucky-row">
                    <span className="lucky-key">🔢 행운의 숫자</span>
                    <span className="lucky-val">{result.number}</span>
                  </div>
                  <div className="lucky-row">
                    <span className="lucky-key">🤝 귀인의 초성</span>
                    <span className="lucky-val">
                      {result.initials.map((c) => (
                        <span className="initial-chip" key={c}>
                          {c}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="birth-row">
        <label htmlFor="birth" className="birth-label">
          🎂 생년월일
        </label>
        <input
          id="birth"
          className="birth-input"
          type="date"
          value={birthdate}
          max="2099-12-31"
          onChange={(e) => handleBirthdate(e.target.value)}
        />
      </div>

      <div className="btn-row">
        <button
          className="draw-btn"
          onClick={handleDraw}
          disabled={busy || aiLoading}
        >
          {flipped ? "다시 뽑기" : "운세 뽑기"}
        </button>
        <button
          className="draw-btn ai"
          onClick={handleDrawAI}
          disabled={busy || aiLoading}
        >
          {aiLoading ? "AI가 그리는 중…" : "✨ AI 운세"}
        </button>
      </div>

      {aiError && <p className="ai-error">{aiError}</p>}
      <p className="hint">재미로 보는 운세입니다 ✨</p>

      <section className="history">
        <div className="history-head">
          <h3 className="history-title">
            📜 {user ? "내 운세 기록" : "이 기기의 운세 기록"}
          </h3>
          {history.length > 0 && (
            <button className="history-clear" onClick={clearHistory}>
              기록 지우기
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="history-empty">
            아직 뽑은 운세가 없어요. 위에서 운세를 뽑아보세요!
          </p>
        ) : (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>뽑은 시각</th>
                  <th>운세</th>
                  <th className="col-score">지수</th>
                  <th className="col-item">행운의 아이템</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id ?? h.at}>
                    <td className="col-time">{formatTime(h.at)}</td>
                    <td>
                      <span className="hist-emoji">{h.emoji}</span>
                      {h.title}
                    </td>
                    <td className="col-score">{h.score}점</td>
                    <td className="col-item">{h.item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function formatTime(ms) {
  return new Date(ms).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
