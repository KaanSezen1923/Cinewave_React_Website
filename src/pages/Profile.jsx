import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    apiFetch,
    getFeedbackStats,
    getProfilePersona,
    refreshProfilePersona,
} from "../api/api";
import { useAuth } from "../context/AuthContext";

const GENRE_TR_LABELS = {
    "Action": "Aksiyon",
    "Adventure": "Macera",
    "Animation": "Animasyon",
    "Comedy": "Komedi",
    "Crime": "Suç",
    "Documentary": "Belgesel",
    "Drama": "Dram",
    "Family": "Aile",
    "Fantasy": "Fantastik",
    "History": "Tarih",
    "Horror": "Korku",
    "Music": "Müzik",
    "Mystery": "Gizem",
    "Romance": "Romantik",
    "Science Fiction": "Bilim Kurgu",
    "Sci-Fi": "Bilim Kurgu",
    "TV Movie": "TV Filmi",
    "Thriller": "Gerilim",
    "War": "Savaş",
    "Western": "Western",
    "Action & Adventure": "Aksiyon ve Macera",
    "Sci-Fi & Fantasy": "Bilim Kurgu ve Fantastik",
    "War & Politics": "Savaş ve Politik",
};

function translateGenre(name) {
    if (!name) return "";
    const trimmed = String(name).trim();
    return GENRE_TR_LABELS[trimmed] || trimmed;
}

/**
 * Eğer kullanıcının arka planda oluşan AI persona_summary kaydı henüz boşsa
 * (veya backend henüz güncellenmemişse) favori listesinden otomatik bir zevk profili çıkarır.
 */
function buildFallbackPersonaFromFavorites(favorites = []) {
    if (!Array.isArray(favorites) || favorites.length === 0) {
        return {
            genres: {},
            directors: {},
            actors: {},
            avoid: [],
            vibe_summary: "",
            isFallback: true,
        };
    }

    const genreCounts = {};
    const directorCounts = {};
    const actorCounts = {};

    favorites.forEach((fav) => {
        const gStr = fav.Türler || fav.genres || "";
        gStr.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((g) => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
            });

        const dStr = fav.Director || fav.director || "";
        dStr.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((d) => {
                directorCounts[d] = (directorCounts[d] || 0) + 1;
            });

        const cStr = fav.Cast || fav.cast_members || "";
        cStr.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 3)
            .forEach((a) => {
                actorCounts[a] = (actorCounts[a] || 0) + 1;
            });
    });

    const maxGenre = Math.max(...Object.values(genreCounts), 1);
    const genres = {};
    Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([k, count]) => {
            genres[k] = Number(Math.min(0.98, Math.max(0.35, count / maxGenre)).toFixed(2));
        });

    const maxDir = Math.max(...Object.values(directorCounts), 1);
    const directors = {};
    Object.entries(directorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .forEach(([k, count]) => {
            directors[k] = Number(Math.min(0.95, Math.max(0.5, count / maxDir)).toFixed(2));
        });

    const maxAct = Math.max(...Object.values(actorCounts), 1);
    const actors = {};
    Object.entries(actorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .forEach(([k, count]) => {
            actors[k] = Number(Math.min(0.95, Math.max(0.5, count / maxAct)).toFixed(2));
        });

    const topGenreNames = Object.keys(genres)
        .slice(0, 3)
        .map(translateGenre);
    const topDirectorNames = Object.keys(directors).slice(0, 2);

    let vibe = "";
    if (topGenreNames.length > 0) {
        vibe = `Favori listenize göre ağırlıklı olarak ${topGenreNames.join(", ")} türündeki yapımlara ilgi duyuyorsunuz.`;
        if (topDirectorNames.length > 0) {
            vibe += ` Özellikle ${topDirectorNames.join(" ve ")} imzalı yapımlar sinema zevkinizde öne çıkıyor.`;
        }
    }

    return {
        genres,
        directors,
        actors,
        avoid: [],
        vibe_summary: vibe,
        isFallback: true,
    };
}

export default function Profile() {
    const { user, login } = useAuth();
    const queryClient = useQueryClient();
    const [newUsername, setNewUsername] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [statusMessage, setStatusMessage] = useState(null);

    // 1. Geri Bildirim İstatistiklerini Çekme (GET /feedback/stats)
    const { data: feedbackStats, isLoading: isStatsLoading } = useQuery({
        queryKey: ["feedback-stats"],
        queryFn: getFeedbackStats,
        staleTime: 1000 * 30,
    });

    // 2. AI Zevk Profilini Çekme (GET /profile/persona - eski backend ise sessizce null döner)
    const { data: personaData } = useQuery({
        queryKey: ["profile-persona"],
        queryFn: async () => {
            try {
                return await getProfilePersona();
            } catch {
                return null;
            }
        },
        retry: 0,
        staleTime: 1000 * 60,
    });

    // 3. Favorileri Çekme (Hem özet sayı hem de yedek zevk analizi için)
    const { data: favoritesData } = useQuery({
        queryKey: ["favorites-profile"],
        queryFn: () => apiFetch("/favorites?limit=50&offset=0"),
        staleTime: 1000 * 60,
    });

    // 4. Sohbet Oturumlarını Çekme
    const { data: sessionsData } = useQuery({
        queryKey: ["sessions"],
        queryFn: () => apiFetch("/sessions"),
    });

    // AI Profilini Şimdi Güncelle (POST /profile/refresh)
    const { mutate: triggerProfileRefresh, isPending: isRefreshingPersona } = useMutation({
        mutationFn: refreshProfilePersona,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["profile-persona"] });
            queryClient.invalidateQueries({ queryKey: ["feedback-stats"] });
            setStatusMessage({
                type: "success",
                text: "AI zevk profiliniz son sohbet ve beğenilerinize göre güncellendi!",
            });
        },
        onError: () => {
            setStatusMessage({
                type: "info",
                text: "AI profiliniz her 5 sohbet mesajında bir arka planda otomatik güncellenir.",
            });
        },
    });

    // Oturum Silme
    const { mutate: deleteSession } = useMutation({
        mutationFn: (sessionId) => apiFetch(`/chat/${sessionId}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sessions"] });
        },
    });

    // İstatistik Hesaplamaları (chat + push birleşimi)
    const statsSummary = useMemo(() => {
        const chat = feedbackStats?.chat || { shown: 0, likes: 0, dislikes: 0, like_rate: null, like_per_shown: null };
        const push = feedbackStats?.push || { shown: 0, likes: 0, dislikes: 0, like_rate: null, like_per_shown: null };

        const shown = (chat.shown || 0) + (push.shown || 0);
        const likes = (chat.likes || 0) + (push.likes || 0);
        const dislikes = (chat.dislikes || 0) + (push.dislikes || 0);
        const rated = likes + dislikes;
        const likeRate = rated > 0 ? likes / rated : null;
        const likePerShown = shown > 0 ? likes / shown : null;

        return {
            chat,
            push,
            shown,
            likes,
            dislikes,
            rated,
            likeRate,
            likePerShown,
        };
    }, [feedbackStats]);

    // AI Zevk Profili (Backend persona_summary varsa onu kullan, yoksa favorilerden üret)
    const activePersona = useMemo(() => {
        const rawBackendPersona =
            personaData?.persona || feedbackStats?.persona || null;

        const hasBackendData =
            rawBackendPersona &&
            (Object.keys(rawBackendPersona.genres || {}).length > 0 ||
                Object.keys(rawBackendPersona.directors || {}).length > 0 ||
                Object.keys(rawBackendPersona.actors || {}).length > 0 ||
                (rawBackendPersona.avoid || []).length > 0 ||
                Boolean(rawBackendPersona.vibe_summary));

        if (hasBackendData) {
            return {
                genres: rawBackendPersona.genres || {},
                directors: rawBackendPersona.directors || {},
                actors: rawBackendPersona.actors || {},
                avoid: rawBackendPersona.avoid || [],
                vibe_summary: rawBackendPersona.vibe_summary || "",
                isFallback: false,
            };
        }

        return buildFallbackPersonaFromFavorites(favoritesData?.favorites || []);
    }, [personaData, feedbackStats, favoritesData]);

    const sortedGenres = useMemo(
        () =>
            Object.entries(activePersona.genres || {})
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 8),
        [activePersona.genres]
    );

    const sortedDirectors = useMemo(
        () =>
            Object.entries(activePersona.directors || {})
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 8),
        [activePersona.directors]
    );

    const sortedActors = useMemo(
        () =>
            Object.entries(activePersona.actors || {})
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 8),
        [activePersona.actors]
    );

    const avoidList = activePersona.avoid || [];
    const totalFavorites = favoritesData?.total ?? (favoritesData?.favorites?.length || 0);
    const sessions = sessionsData?.sessions || [];

    // Kullanıcı Adı Değiştirme
    const updateUsername = async (e) => {
        e.preventDefault();
        try {
            await apiFetch("/update-profile", {
                method: "POST",
                body: JSON.stringify({ new_username: newUsername }),
            });
            login(user.token, newUsername);
            setNewUsername("");
            setStatusMessage({ type: "success", text: "Kullanıcı adı başarıyla güncellendi." });
        } catch (err) {
            setStatusMessage({ type: "error", text: "Hata: " + err.message });
        }
    };

    // Şifre Değiştirme
    const updatePassword = async (e) => {
        e.preventDefault();
        try {
            await apiFetch("/change-password", {
                method: "POST",
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
            });
            setOldPassword("");
            setNewPassword("");
            setStatusMessage({ type: "success", text: "Şifreniz başarıyla değiştirildi." });
        } catch (err) {
            setStatusMessage({ type: "error", text: "Hata: " + err.message });
        }
    };

    return (
        <div className="page-container animate-fade-in">
            {/* Üst Kullanıcı Özeti Başlığı */}
            <div className="profile-hero-card glass-panel">
                <div className="profile-hero-left">
                    <div className="profile-avatar-xl">
                        {(user?.username || "K").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="profile-hero-badge">CineWave AI Üyesi</div>
                        <h1 className="profile-hero-username">{user?.username || "Kullanıcı"}</h1>
                        <p className="profile-hero-sub">
                            Kişiselleştirilmiş sinema DNA'nız, öneri geri bildirim istatistikleriniz ve hesap ayarlarınız
                        </p>
                    </div>
                </div>

                <div className="profile-hero-actions">
                    <button
                        type="button"
                        onClick={() => triggerProfileRefresh()}
                        disabled={isRefreshingPersona}
                        className="btn-primary"
                        style={{ padding: "10px 18px", fontSize: "0.9rem" }}
                    >
                        <span>✨</span>
                        <span>
                            {isRefreshingPersona ? "Analiz Ediliyor..." : "AI Profilimi Güncelle"}
                        </span>
                    </button>
                    <Link to="/discover" className="btn-secondary" style={{ padding: "10px 18px", fontSize: "0.9rem" }}>
                        🤖 AI Asistana Git
                    </Link>
                </div>
            </div>

            {statusMessage && (
                <div className={`profile-status-banner ${statusMessage.type}`}>
                    <span>{statusMessage.text}</span>
                    <button
                        type="button"
                        onClick={() => setStatusMessage(null)}
                        className="profile-status-close"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Üst Özet Metrik Kartları */}
            <div className="profile-kpi-grid">
                <div className="profile-kpi-card glass-panel">
                    <span className="profile-kpi-icon">🎯</span>
                    <div>
                        <div className="profile-kpi-value">
                            {statsSummary.likeRate !== null
                                ? `%${Math.round(statsSummary.likeRate * 100)}`
                                : "—"}
                        </div>
                        <div className="profile-kpi-label">Genel Beğeni Oranı</div>
                    </div>
                </div>

                <div className="profile-kpi-card glass-panel">
                    <span className="profile-kpi-icon">🎬</span>
                    <div>
                        <div className="profile-kpi-value">{statsSummary.shown}</div>
                        <div className="profile-kpi-label">İncelenen AI Önerisi</div>
                    </div>
                </div>

                <div className="profile-kpi-card glass-panel">
                    <span className="profile-kpi-icon">👍</span>
                    <div>
                        <div className="profile-kpi-value">
                            {statsSummary.likes}{" "}
                            <small style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                / {statsSummary.dislikes} 👎
                            </small>
                        </div>
                        <div className="profile-kpi-label">Beğenilen / Beğenilmeyen</div>
                    </div>
                </div>

                <div className="profile-kpi-card glass-panel">
                    <span className="profile-kpi-icon">❤️</span>
                    <div>
                        <div className="profile-kpi-value">{totalFavorites}</div>
                        <div className="profile-kpi-label">Favori Yapımlarım</div>
                    </div>
                </div>
            </div>

            {/* Ana İki Sütunlu Grid: AI Zevk Profili & Geri Bildirim İstatistikleri */}
            <div className="profile-main-grid">
                {/* SOL SÜTUN: AI Zevk Profili (Persona) */}
                <section className="glass-panel profile-section-card">
                    <div className="profile-section-header">
                        <div>
                            <h2 className="profile-section-title">
                                <span>🧬</span>
                                <span>AI Sinema DNA'm ve Zevk Profili</span>
                            </h2>
                            <p className="profile-section-subtitle">
                                {activePersona.isFallback
                                    ? "Favorilerinizden türetilen başlangıç profili (Sohbet ettikçe AI tarafından derinleştirilir)"
                                    : "Sohbet geçmişiniz, favorileriniz ve geri bildirimlerinizden öğrenilen ağırlıklı profil"}
                            </p>
                        </div>
                    </div>

                    {/* Vibe Summary */}
                    <div className="persona-vibe-box">
                        <div className="persona-vibe-label">✨ Sinema Karakteristiğiniz (Vibe Özeti)</div>
                        <p className="persona-vibe-text">
                            {activePersona.vibe_summary ||
                                "Henüz yeterli etkileşim verisi oluşmadı. AI Keşfet sayfasında birkaç film/dizi sorup önerileri beğendikçe veya favorilerinize yapım ekledikçe kişisel sinema karakteristiğiniz burada belirecek."}
                        </p>
                    </div>

                    {/* Favori Tür Ağırlıkları */}
                    <div className="persona-block">
                        <h3 className="persona-block-title">📊 Favori Tür Ağırlıkları</h3>
                        {sortedGenres.length === 0 ? (
                            <p className="persona-empty-note">
                                Tür ağırlıklarınızın hesaplanması için birkaç yapımı favorilerinize ekleyin veya AI önerilerini oylayın.
                            </p>
                        ) : (
                            <div className="genre-bars-list">
                                {sortedGenres.map(([genre, weight]) => {
                                    const pct = Math.round(Math.min(1, Math.max(0, Number(weight))) * 100);
                                    return (
                                        <div key={genre} className="genre-bar-item">
                                            <div className="genre-bar-label-row">
                                                <span className="genre-bar-name">
                                                    {translateGenre(genre)}
                                                </span>
                                                <span className="genre-bar-pct">%{pct}</span>
                                            </div>
                                            <div className="genre-bar-track">
                                                <div
                                                    className="genre-bar-fill"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Sevdiği Yönetmenler ve Oyuncular */}
                    <div className="persona-two-col">
                        <div className="persona-block">
                            <h3 className="persona-block-title">🎬 Favori Yönetmenler</h3>
                            {sortedDirectors.length === 0 ? (
                                <p className="persona-empty-note">Henüz belirgin bir yönetmen tercihi yok.</p>
                            ) : (
                                <div className="persona-tag-cloud">
                                    {sortedDirectors.map(([name, weight]) => (
                                        <span key={name} className="persona-tag persona-tag-director">
                                            <span>{name}</span>
                                            <small>%{Math.round(Number(weight) * 100)}</small>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="persona-block">
                            <h3 className="persona-block-title">🎭 Favori Oyuncular</h3>
                            {sortedActors.length === 0 ? (
                                <p className="persona-empty-note">Henüz belirgin bir oyuncu tercihi yok.</p>
                            ) : (
                                <div className="persona-tag-cloud">
                                    {sortedActors.map(([name, weight]) => (
                                        <span key={name} className="persona-tag persona-tag-actor">
                                            <span>{name}</span>
                                            <small>%{Math.round(Number(weight) * 100)}</small>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Kaçındığı Türler / Temalar */}
                    <div className="persona-block">
                        <h3 className="persona-block-title">🚫 Kaçınılan Türler ve Temalar (Avoid Filtresi)</h3>
                        {avoidList.length === 0 ? (
                            <p className="persona-empty-note">
                                Şu an engellenen bir tür bulunmuyor. Sohbette &ldquo;korku olmasın&rdquo; dediğinizde veya önerilere 👎 verdiğinizde AI bunları otomatik öğrenir.
                            </p>
                        ) : (
                            <div className="persona-tag-cloud">
                                {avoidList.map((item) => (
                                    <span key={item} className="persona-tag persona-tag-avoid">
                                        🚫 {translateGenre(item)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* SAĞ SÜTUN: Geri Bildirim İstatistikleri (GET /feedback/stats) */}
                <section className="glass-panel profile-section-card">
                    <div className="profile-section-header">
                        <div>
                            <h2 className="profile-section-title">
                                <span>📈</span>
                                <span>Öneri Geri Bildirim İstatistikleri</span>
                            </h2>
                            <p className="profile-section-subtitle">
                                AI önerilerine verdiğiniz 👍 Beğendim ve 👎 Beğenmedim oylarının kanal bazlı analizi
                            </p>
                        </div>
                    </div>

                    {isStatsLoading ? (
                        <p style={{ color: "var(--text-secondary)" }}>İstatistikler yükleniyor...</p>
                    ) : (
                        <>
                            {/* Genel Oran Çubuğu */}
                            <div className="feedback-overview-box">
                                <div className="feedback-overview-header">
                                    <div>
                                        <span className="feedback-big-rate">
                                            {statsSummary.likeRate !== null
                                                ? `%${Math.round(statsSummary.likeRate * 100)}`
                                                : "%0"}
                                        </span>
                                        <span className="feedback-rate-caption">
                                            Oylanan Önerilerde İsabet Oranı ({statsSummary.likes} 👍 / {statsSummary.rated} oy)
                                        </span>
                                    </div>
                                    {statsSummary.likePerShown !== null && (
                                        <span className="feedback-per-shown-pill">
                                            Gösterim Başına Beğeni: %{Math.round(statsSummary.likePerShown * 100)}
                                        </span>
                                    )}
                                </div>

                                <div className="feedback-dual-bar">
                                    <div
                                        className="feedback-bar-like"
                                        style={{
                                            width:
                                                statsSummary.rated > 0
                                                    ? `${Math.round((statsSummary.likes / statsSummary.rated) * 100)}%`
                                                    : "50%",
                                        }}
                                    />
                                </div>

                                <div className="feedback-legend-row">
                                    <span style={{ color: "#4ade80" }}>
                                        ● Beğenilen: {statsSummary.likes}
                                    </span>
                                    <span style={{ color: "var(--text-muted)" }}>
                                        ● Henüz Oylanmayan: {Math.max(0, statsSummary.shown - statsSummary.rated)}
                                    </span>
                                    <span style={{ color: "#f87171" }}>
                                        ● Beğenilmeyen: {statsSummary.dislikes}
                                    </span>
                                </div>
                            </div>

                            {/* Kanal Bazlı Kartlar: Chat vs Push */}
                            <div className="feedback-channels-grid">
                                {[
                                    {
                                        key: "chat",
                                        title: "💬 Sohbet Asistanı Önerileri",
                                        desc: "AI Keşfet sohbetinde sunulan film ve dizi kartları",
                                        data: statsSummary.chat,
                                    },
                                    {
                                        key: "push",
                                        title: "🔔 Proaktif Bildirim Önerileri",
                                        desc: "Arka planda zevkinize göre üretilen özel öneriler",
                                        data: statsSummary.push,
                                    },
                                ].map((ch) => {
                                    const s = ch.data || {};
                                    const shown = s.shown || 0;
                                    const likes = s.likes || 0;
                                    const dislikes = s.dislikes || 0;
                                    const likeRatePct =
                                        s.like_rate !== null && s.like_rate !== undefined
                                            ? `%${Math.round(s.like_rate * 100)}`
                                            : "—";
                                    const perShownPct =
                                        s.like_per_shown !== null && s.like_per_shown !== undefined
                                            ? `%${Math.round(s.like_per_shown * 100)}`
                                            : "—";

                                    return (
                                        <div key={ch.key} className="feedback-channel-card">
                                            <div className="feedback-channel-top">
                                                <h4>{ch.title}</h4>
                                                <span className="feedback-channel-badge">
                                                    Beğeni Oranı: {likeRatePct}
                                                </span>
                                            </div>
                                            <p className="feedback-channel-desc">{ch.desc}</p>

                                            <div className="feedback-channel-metrics">
                                                <div>
                                                    <strong>{shown}</strong>
                                                    <span>Gösterilen</span>
                                                </div>
                                                <div>
                                                    <strong style={{ color: "#4ade80" }}>{likes}</strong>
                                                    <span>Beğenilen</span>
                                                </div>
                                                <div>
                                                    <strong style={{ color: "#f87171" }}>{dislikes}</strong>
                                                    <span>Reddedilen</span>
                                                </div>
                                                <div>
                                                    <strong>{perShownPct}</strong>
                                                    <span>Beğeni / Gösterim</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </section>
            </div>

            {/* Alt Bölüm: Hesap Ayarları ve Sohbet Geçmişi Yönetimi */}
            <div className="profile-main-grid" style={{ marginTop: "28px" }}>
                {/* Güvenlik ve Hesap Ayarları */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div className="glass-panel" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>
                            ✏️ Kullanıcı Adı Değiştir
                        </h3>
                        <form onSubmit={updateUsername} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Yeni kullanıcı adı"
                                required
                                style={{ flex: 1, minWidth: "200px" }}
                            />
                            <button type="submit" className="btn-primary" style={{ padding: "10px 18px" }}>
                                Güncelle
                            </button>
                        </form>
                    </div>

                    <div className="glass-panel" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>
                            🔒 Şifre Değiştir
                        </h3>
                        <form onSubmit={updatePassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Mevcut şifre"
                                required
                            />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Yeni şifre"
                                required
                            />
                            <button type="submit" className="btn-secondary" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
                                Şifreyi Güncelle
                            </button>
                        </form>
                    </div>
                </div>

                {/* Geçmiş Sohbet Oturumları */}
                <div className="glass-panel" style={{ padding: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ fontSize: "1.2rem", margin: 0 }}>
                            💬 Geçmiş AI Sohbet Oturumları ({sessions.length})
                        </h3>
                        <Link to="/discover" className="showcase-explore-link">
                            Yeni Sohbet →
                        </Link>
                    </div>

                    {sessions.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
                            Henüz kayıtlı bir sohbet oturumunuz bulunmuyor.
                        </p>
                    ) : (
                        <div className="profile-sessions-list">
                            {sessions.slice(0, 8).map((s) => (
                                <div key={s.session_id} className="profile-session-row">
                                    <span className="profile-session-title" title={s.title}>
                                        💬 {s.title || "Yeni Sohbet"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => deleteSession(s.session_id)}
                                        className="profile-session-del-btn"
                                        title="Oturumu Sil"
                                    >
                                        Sil
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}