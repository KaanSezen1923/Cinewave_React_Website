import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFeedbackIds } from "../hooks/useFeedbackIds";
import { apiFetch } from "../api/api";

/**
 * Film kartlarının altına konan 👍 / 👎 butonları.
 *
 * Props:
 *  - apiBase   : örn. "http://localhost:3000" (varsayılan: VITE_API_URL)
 *  - token     : JWT access_token (varsayılan: localStorage token)
 *  - movie     : öneri kartı ({ movie_id, Film, ... }) veya { movie_id, title }
 *  - source    : "chat" | "push"
 *  - sessionId : sohbet oturumu (chat için)
 *  - initial   : "like" | "dislike" | null  (GET /feedback/ids ile doldurulur)
 *  - onChange  : (value) => void   (opsiyonel; üst bileşen state tutuyorsa)
 *  - style     : React.CSSProperties
 *  - className : opsiyonel css sınıfı
 *
 * Aynı butona tekrar basmak oyu geri alır ("clear").
 */
export function FeedbackButtons({
  apiBase,
  token,
  movie,
  source = "chat",
  sessionId,
  initial = null,
  onChange,
  style = {},
  className = "",
}) {
  const queryClient = useQueryClient();
  const { data: feedbackIds } = useFeedbackIds();

  const movieId = String(movie?.movie_id || movie?.id || "");
  const movieTitle = movie?.Film ?? movie?.title ?? null;

  // initial prop'u varsa kullan, yoksa React Query cache'inden otomatik çöz
  const resolvedInitial =
    initial !== null && initial !== undefined
      ? initial
      : movieId && feedbackIds?.liked?.includes(movieId)
      ? "like"
      : movieId && feedbackIds?.disliked?.includes(movieId)
      ? "dislike"
      : null;

  const [value, setValue] = useState(resolvedInitial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(resolvedInitial);
  }, [resolvedInitial]);

  const effectiveApiBase =
    apiBase || import.meta.env.VITE_API_URL || "https://movierag-api.onrender.com";
  const effectiveToken = token || localStorage.getItem("token");

  const vote = async (target) => {
    if (busy || !movie) return;

    if (!effectiveToken) {
      alert("Önerilere geri bildirim vermek için lütfen giriş yapın.");
      return;
    }

    const next = value === target ? null : target; // toggle
    const previous = value;

    setValue(next); // iyimser güncelleme
    onChange?.(next);
    setBusy(true);

    if (!movieId) {
      setBusy(false);
      return;
    }

    try {
      if (apiBase || token) {
        const res = await fetch(`${effectiveApiBase}/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify({
            movie_id: movieId,
            title: movieTitle,
            feedback: next ?? "clear",
            source,
            session_id: sessionId ?? null,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        await apiFetch("/feedback", {
          method: "POST",
          body: JSON.stringify({
            movie_id: movieId,
            title: movieTitle,
            feedback: next ?? "clear",
            source,
            session_id: sessionId ?? null,
          }),
        });
      }

      // Başarılı olunca tüm feedback cache'lerini güncelle
      queryClient.invalidateQueries({ queryKey: ["feedbackIds"] });
      queryClient.invalidateQueries({ queryKey: ["feedbackStats"] });
    } catch (err) {
      console.error("Feedback gönderilemedi:", err);
      setValue(previous); // geri al
      onChange?.(previous);
    } finally {
      setBusy(false);
    }
  };

  const btnBase = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "8px",
    padding: "5px 9px",
    cursor: busy ? "not-allowed" : "pointer",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    fontSize: "13px",
    lineHeight: 1,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    userSelect: "none",
  };

  const likeActive = {
    background: "rgba(34, 197, 94, 0.25)",
    borderColor: "rgba(34, 197, 94, 0.6)",
    color: "#4ade80",
    transform: "scale(1.08)",
    boxShadow: "0 0 10px rgba(34, 197, 94, 0.25)",
  };

  const dislikeActive = {
    background: "rgba(239, 68, 68, 0.25)",
    borderColor: "rgba(239, 68, 68, 0.6)",
    color: "#f87171",
    transform: "scale(1.08)",
    boxShadow: "0 0 10px rgba(239, 68, 68, 0.25)",
  };

  return (
    <div
      className={`feedback-buttons-group ${className}`}
      style={{ display: "inline-flex", gap: "6px", alignItems: "center", ...style }}
    >
      <button
        type="button"
        aria-pressed={value === "like"}
        aria-label="Bu öneriyi beğendim"
        title="Öneriyi Beğendim"
        style={{ ...btnBase, ...(value === "like" ? likeActive : null) }}
        onClick={() => vote("like")}
        disabled={busy}
      >
        👍
      </button>
      <button
        type="button"
        aria-pressed={value === "dislike"}
        aria-label="Bu öneriyi beğenmedim"
        title="Öneriyi Beğenmedim"
        style={{ ...btnBase, ...(value === "dislike" ? dislikeActive : null) }}
        onClick={() => vote("dislike")}
        disabled={busy}
      >
        👎
      </button>
    </div>
  );
}

export default FeedbackButtons;
