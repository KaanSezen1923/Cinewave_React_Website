import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecommendations, markRecommendationsAsRead } from '../api/api';
import { Skeleton } from '../components/Skeleton';
import { ErrorBox } from '../components/ErrorBox';
import { FeedbackButtons } from '../components/FeedbackButtons';

const Recommendations = () => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getRecommendations();
                const list = Array.isArray(data) ? data : (data?.recommendations || []);
                setRecommendations(list);

                // Sayfa açıldığında okunmamış öneriler varsa okundu olarak işaretle
                const hasUnread = list.some(rec => !rec.is_read);
                if (hasUnread) {
                    await markRecommendationsAsRead();
                }
            } catch (err) {
                console.error("Öneriler alınırken hata oluştu:", err);
                setError(err.message || "Öneriler yüklenemedi. Lütfen daha sonra tekrar deneyin.");
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, []);

    if (loading) {
        return (
            <div className="page-container animate-fade-in">
                <div className="page-header">
                    <h1 className="page-title">
                        <span>💡</span>
                        <span>Sana Özel Öneriler</span>
                    </h1>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <Skeleton count={3} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container animate-fade-in">
                <div className="page-header">
                    <h1 className="page-title">
                        <span>💡</span>
                        <span>Sana Özel Öneriler</span>
                    </h1>
                </div>
                <ErrorBox message={error} />
                <div style={{ marginTop: "20px", textAlign: "center" }}>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary"
                        style={{ padding: "10px 24px" }}
                    >
                        Tekrar Dene
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <span>💡</span>
                        <span>Sana Özel Öneriler</span>
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "4px" }}>
                        İzleme alışkanlıklarına ve AI analizine göre senin için hazırlanan bildirimler.
                    </p>
                </div>
                {recommendations.length > 0 && (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        Toplam {recommendations.length} öneri
                    </span>
                )}
            </div>

            {recommendations.length === 0 ? (
                <div style={{
                    textAlign: "center",
                    padding: "70px 20px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    maxWidth: "600px",
                    margin: "40px auto"
                }}>
                    <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>🍿</div>
                    <h2 style={{ fontSize: "1.6rem", marginBottom: "10px", color: "#fff" }}>
                        Henüz Bir Öneri Bulunmuyor
                    </h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "24px", lineHeight: "1.6", maxWidth: "460px", margin: "0 auto 24px" }}>
                        AI asistanı ile film ve diziler hakkında sohbet ettikçe zevkine özel öneriler burada listelenecektir.
                    </p>
                    <Link to="/discover" className="btn-primary" style={{ padding: "12px 28px" }}>
                        ✨ AI Asistanı ile Sohbet Et
                    </Link>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "800px" }}>
                    {recommendations.map((rec) => {
                        const recDate = rec.date ? new Date(rec.date).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }) : '';

                        return (
                            <div
                                key={rec.id}
                                className="glass-panel"
                                style={{
                                    padding: "20px 24px",
                                    borderLeft: rec.is_read
                                        ? "4px solid rgba(255, 255, 255, 0.15)"
                                        : "4px solid var(--accent-red)",
                                    background: rec.is_read
                                        ? "rgba(22, 26, 38, 0.5)"
                                        : "rgba(28, 34, 50, 0.85)",
                                    transition: "all var(--transition-fast)",
                                    position: "relative"
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "12px", flexWrap: "wrap" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <span style={{ fontSize: "1.4rem" }}>🎬</span>
                                        <h3 style={{ fontSize: "1.25rem", color: "#fff", margin: 0 }}>
                                            {rec.title}
                                        </h3>
                                        {!rec.is_read && (
                                            <span style={{
                                                fontSize: "0.75rem",
                                                fontWeight: 700,
                                                padding: "2px 8px",
                                                background: "rgba(229, 9, 20, 0.2)",
                                                color: "var(--accent-red)",
                                                borderRadius: "var(--radius-full)",
                                                border: "1px solid rgba(229, 9, 20, 0.4)"
                                            }}>
                                                Yeni
                                            </span>
                                        )}
                                    </div>
                                    {recDate && (
                                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                            🕒 {recDate}
                                        </span>
                                    )}
                                </div>

                                <p style={{ color: "var(--text-secondary)", fontSize: "0.96rem", lineHeight: "1.6", margin: "0 0 16px 0" }}>
                                    {rec.body}
                                </p>

                                <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                                    <Link
                                        to={`/film/${encodeURIComponent(rec.title)}`}
                                        className="btn-secondary"
                                        style={{ padding: "8px 16px", fontSize: "0.85rem", gap: "6px" }}
                                    >
                                        <span>Detayları Gör</span>
                                        <span>→</span>
                                    </Link>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Öneriyi Değerlendir:</span>
                                        <FeedbackButtons
                                            movie={{ movie_id: rec.movie_id, title: rec.title }}
                                            source="push"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Recommendations;