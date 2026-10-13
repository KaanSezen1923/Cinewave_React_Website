import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { adaptChatCard } from "../utils/adapters";
import { MovieCard } from "./MovieCard";
import { useAuth } from "../context/AuthContext";

/* Varsayılan İlham Verici Öneriler */
const DEFAULT_PROMPTS = [
    { icon: "🧠", title: "Zihin Bükücü & Gizem", text: "Christopher Nolan tarzında zihin yakan, sonu ters köşe filmler öner." },
    { icon: "🧛", title: "Karanlık & Gotik Korku", text: "Dracula atmosferinde, 90'lar ve klasik vampir/gotik filmleri listele." },
    { icon: "🪐", title: "Derin Uzay & Bilim Kurgu", text: "Yıldızlararası gibi derin felsefesi olan gerçekçi uzay filmleri tavsiye et." },
    { icon: "🍿", title: "Sürükleyici Mini Dizi", text: "Tek oturuşta bitirmelik, temposu hiç düşmeyen sürükleyici bir mini dizi öner." },
];

/* Asistan cevabını güvenle çözümle: JSON veya düz metin */
function parseAssistantContent(content) {
    if (typeof content !== "string") return { text: "", movies: [] };
    const trimmed = content.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        return { text: content, movies: [] };
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return { text: "", movies: parsed };
        if (parsed && typeof parsed === "object") {
            return { text: parsed.text || "", movies: parsed.movies || [] };
        }
    } catch {
        /* düz metin olarak devam */
    }
    return { text: content, movies: [] };
}

function RecommendationCard({ movie }) {
    const card = adaptChatCard(movie);
    const reason = movie["Neden Önerildi"] || movie.reason || "Zevkine göre özenle seçildi.";
    const genres = movie["Türler"];
    const detailLink = card.mediaType === "tv" ? `/dizi/${card.id}` : `/film/${card.id}`;

    return (
        <div className="recommendation-card">
            <div className="recommendation-poster-wrap">
                <MovieCard item={card} />
            </div>
            <div className="recommendation-info">
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", color: "#fff" }}>
                    {card.title} {card.year ? `(${card.year})` : ""}
                </h4>
                <p className="recommendation-reason">
                    “{reason}”
                </p>
                <div className="recommendation-meta">
                    {genres && (
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                            🏷️ {genres}
                        </span>
                    )}
                    <Link to={detailLink} className="recommendation-link">
                        Detayları İncele →
                    </Link>
                </div>
            </div>
        </div>
    );
}

function AssistantMessage({ content }) {
    const { text, movies } = parseAssistantContent(content);
    return (
        <div>
            {text && (
                <p style={{ margin: movies.length ? "0 0 16px" : 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {text}
                </p>
            )}
            {movies.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {movies.map((m, idx) => (
                        <RecommendationCard key={m.movie_id || m.id || idx} movie={m} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ChatPanel() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isWaiting, setIsWaiting] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
    const messagesEndRef = useRef(null);

    // Sidebar: Geçmiş sohbetler
    const { data: sessionsData } = useQuery({
        queryKey: ["chatSessions"],
        queryFn: () => apiFetch("/sessions"),
        enabled: !!user,
    });

    // Hazır öneriler
    const { data: suggestionsData } = useQuery({
        queryKey: ["chatSuggestions"],
        queryFn: () => apiFetch("/chat/suggestions"),
        enabled: !!user,
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isWaiting, statusText]);

    useEffect(() => {
        if (!isWaiting) {
            setStatusText("");
            return;
        }
        const interval = setInterval(async () => {
            try {
                const res = await apiFetch(`/chat/status/${sessionId}`);
                if (res.status) setStatusText(res.status);
            } catch { }
        }, 2000);
        return () => clearInterval(interval);
    }, [isWaiting, sessionId]);

    const handleSend = async (text) => {
        const prompt = text.trim();
        if (!prompt || isWaiting || !user) return;

        setMessages((prev) => [...prev, { role: "user", content: prompt }]);
        setInput("");
        setIsWaiting(true);

        try {
            const data = await apiFetch("/chat", {
                method: "POST",
                body: JSON.stringify({ prompt, session_id: sessionId }),
            });
            setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
            queryClient.invalidateQueries(["chatSessions"]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Bir sorun oluştu: ${err.message}. Lütfen tekrar deneyin.` },
            ]);
        } finally {
            setIsWaiting(false);
        }
    };

    const resetChat = () => {
        setMessages([]);
        setSessionId(crypto.randomUUID());
    };

    const loadSession = async (id) => {
        if (id === sessionId) return;
        setSessionId(id);
        setMessages([]);
        setIsWaiting(true);
        try {
            const data = await apiFetch(`/chat/${id}`);
            setMessages(data.history || []);
        } catch (err) {
            console.error("Sohbet geçmişi yüklenemedi:", err);
        } finally {
            setIsWaiting(false);
        }
    };

    const deleteSession = async (id, e) => {
        e.stopPropagation();
        try {
            await apiFetch(`/chat/${id}`, { method: "DELETE" });
            queryClient.invalidateQueries(["chatSessions"]);
            if (sessionId === id) resetChat();
        } catch (err) {
            console.error("Sohbet silinemedi:", err);
        }
    };

    const sessions = sessionsData?.sessions || [];
    const suggestions = suggestionsData?.suggestions || [];

    return (
        <div className="ai-console-wrapper animate-fade-in">
            {/* SOL SİDEBAR - GEÇMİŞ SOHBETLER */}
            {user && (
                <aside className="chat-sidebar">
                    <button
                        type="button"
                        className="btn-new-chat"
                        onClick={resetChat}
                        disabled={isWaiting}
                    >
                        <span>✨</span>
                        <span>Yeni Sohbet</span>
                    </button>

                    <div className="sidebar-heading">
                        <span>Geçmiş Sohbetler</span>
                        <span>{sessions.length}</span>
                    </div>

                    <div className="chat-history-list">
                        {sessions.length === 0 ? (
                            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "12px 6px" }}>
                                Henüz geçmiş sohbetiniz yok.
                            </p>
                        ) : (
                            sessions.map((s) => (
                                <div
                                    key={s.session_id}
                                    onClick={() => loadSession(s.session_id)}
                                    className={`chat-history-item ${sessionId === s.session_id ? "active" : ""}`}
                                    title={s.title}
                                >
                                    <span className="chat-history-title">
                                        <span>💬</span>
                                        <span>{s.title}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => deleteSession(s.session_id, e)}
                                        className="btn-history-delete"
                                        title="Sohbeti Sil"
                                        aria-label="Sil"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </aside>
            )}

            {/* SAĞ TARAF - SOHBET VE MESAJ ALANI */}
            <main className="chat-main-area">
                <div className="chat-messages-container" aria-live="polite">
                    {messages.length === 0 ? (
                        <div className="chat-empty-hero">
                            <div className="chat-empty-icon" aria-hidden="true">
                                🎬
                            </div>
                            <h3 className="chat-empty-title">Bugün Ne İzlemek İstersin?</h3>
                            <p className="chat-empty-desc">
                                Ruh haline, sevdiğin oyunculara, yönetmenlere veya anlatmak istediğin bir duyguya göre bana yaz. Sana nokta atışı film ve diziler bulayım.
                            </p>

                            {!user ? (
                                <div style={{
                                    padding: "16px",
                                    background: "rgba(229, 9, 20, 0.1)",
                                    border: "1px solid rgba(229, 9, 20, 0.3)",
                                    borderRadius: "var(--radius-md)",
                                    maxWidth: "400px",
                                    margin: "0 auto"
                                }}>
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0 }}>
                                        AI Asistan ile sohbet etmek için{" "}
                                        <Link to="/login" style={{ color: "var(--accent-red)", fontWeight: 700, textDecoration: "underline" }}>
                                            Giriş Yapın
                                        </Link>
                                    </p>
                                </div>
                            ) : (
                                <div className="prompt-chips-grid">
                                    {DEFAULT_PROMPTS.map((p, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="prompt-chip"
                                            onClick={() => handleSend(p.text)}
                                            disabled={isWaiting}
                                        >
                                            <span className="prompt-chip-icon">{p.icon}</span>
                                            <div>
                                                <strong style={{ display: "block", color: "#fff", marginBottom: "3px" }}>{p.title}</strong>
                                                <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{p.text}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {suggestions.slice(0, 2).map((sug, i) => (
                                        <button
                                            key={`sug-${i}`}
                                            type="button"
                                            className="prompt-chip"
                                            onClick={() => handleSend(sug)}
                                            disabled={isWaiting}
                                        >
                                            <span className="prompt-chip-icon">💡</span>
                                            <div>
                                                <strong style={{ display: "block", color: "#fff", marginBottom: "3px" }}>Öneri</strong>
                                                <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>{sug}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div key={index} className={`chat-row ${msg.role === "user" ? "user" : "assistant"}`}>
                                {msg.role === "assistant" && (
                                    <div className="chat-avatar assistant" title="AI Asistan">
                                        ⚡
                                    </div>
                                )}
                                <div className="chat-bubble-content">
                                    {msg.role === "assistant" ? (
                                        <AssistantMessage content={msg.content} />
                                    ) : (
                                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                                    )}
                                </div>
                                {msg.role === "user" && (
                                    <div className="chat-avatar user" title="Sen">
                                        {(user?.username || "U").charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {isWaiting && (
                        <div className="chat-row assistant">
                            <div className="chat-avatar assistant">⚡</div>
                            <div className="chat-bubble-content" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-secondary)" }}>
                                <span style={{ animation: "pulse 1.2s infinite" }}>✨</span>
                                <span>{statusText || "Film arşivi taranıyor ve analiz ediliyor..."}</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* ALT GİRİŞ KAPSÜLÜ */}
                <div className="chat-bottom-bar">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend(input);
                        }}
                        className="chat-input-capsule"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={user ? "İzlemek istediğin film/dizi konusunu, hissini veya oyuncusunu anlat..." : "Sohbet etmek için giriş yapmalısınız"}
                            className="chat-text-input"
                            disabled={isWaiting || !user}
                            maxLength={500}
                        />
                        <button
                            type="submit"
                            disabled={isWaiting || !user || !input.trim()}
                            className="chat-send-btn"
                        >
                            <span>Gönder</span>
                            <span style={{ fontSize: "1.1rem" }}>➔</span>
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}