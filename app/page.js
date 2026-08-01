"use client";

import { useEffect, useRef, useState } from "react";
import { drawFortune } from "./fortunes";
import { supabase, isSupabaseEnabled } from "./supabaseClient";

const FLIP_MS = 900;
const HISTORY_KEY = "fortune-history"; // localStorage 폴백용
const DEVICE_KEY = "fortune-device-id"; // 로그인이 없으므로 기기별 익명 ID로 기록을 구분
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
  const timers = useRef([]);
  const deviceId = useRef(null);

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

  // 기기별 익명 ID 확보 + 저장된 운세 기록 불러오기 (클라이언트에서만)
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

    if (isSupabaseEnabled) {
      supabase
        .from(TABLE)
        .select("*")
        .eq("device_id", id)
        .order("drawn_at", { ascending: false })
        .limit(HISTORY_MAX)
        .then(({ data, error }) => {
          if (error) {
            console.error("[supabase] 기록 불러오기 실패:", error.message);
            return;
          }
          if (data) setHistory(data.map(mapRow));
        });
    } else {
      // Supabase 미설정 시 localStorage 폴백
      try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        if (Array.isArray(saved)) setHistory(saved);
      } catch {
        // 손상된 데이터는 무시
      }
    }
  }, []);

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

    if (isSupabaseEnabled && deviceId.current) {
      supabase
        .from(TABLE)
        .insert({
          device_id: deviceId.current,
          drawn_at: new Date(at).toISOString(),
          emoji: entry.emoji,
          title: entry.title,
          score: entry.score,
          item: entry.item,
        })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("[supabase] 기록 저장 실패:", error.message);
            return;
          }
          // 임시 항목을 실제 저장된 행으로 교체
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
    if (isSupabaseEnabled && deviceId.current) {
      supabase
        .from(TABLE)
        .delete()
        .eq("device_id", deviceId.current)
        .then(({ error }) => {
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

  const reveal = () => {
    const next = drawFortune();
    setResult(next);
    setScoreWidth(0);
    setFlipped(true);
    record(next);
    after(60, () => setScoreWidth(next.fortune.score));
    after(FLIP_MS, () => setBusy(false));
  };

  const handleDraw = () => {
    if (busy) return;
    setBusy(true);

    if (!flipped) {
      reveal();
      return;
    }

    // 이미 뒤집혀 있으면 되돌린 뒤 새 운세로 다시 뒤집는다
    setFlipped(false);
    after(FLIP_MS + 200, reveal);
  };

  return (
    <main className="page">
      <div className="stars" aria-hidden="true" />

      <header className="header">
        <p className="eyebrow">Today&apos;s Fortune</p>
        <h1 className="title">오늘의 운세</h1>
        <p className="date">{today || " "}</p>
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
                <div className="front-emoji">{result.fortune.emoji}</div>
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

      <button className="draw-btn" onClick={handleDraw} disabled={busy}>
        {flipped ? "다시 뽑기" : "운세 뽑기"}
      </button>

      <p className="hint">재미로 보는 운세입니다 ✨</p>

      <section className="history">
        <div className="history-head">
          <h3 className="history-title">📜 내 운세 기록</h3>
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
