import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { adaptCatalogCard } from "../utils/adapters";
import { MovieGrid } from "../components/MovieGrid";
import { Skeleton } from "../components/Skeleton";
import { ErrorBox } from "../components/ErrorBox";

const FALLBACK_PROFILE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%231a1e2e"/><circle cx="150" cy="180" r="55" fill="%23334155"/><path d="M70 360 C70 280, 230 280, 230 360 Z" fill="%23334155"/><text x="50%" y="400" font-family="-apple-system,sans-serif" font-size="16" font-weight="600" fill="%2364748b" text-anchor="middle">Fotoğraf Yok</text></svg>`;

export default function ActorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [mediaFilter, setMediaFilter] = useState("all"); // 'all' | 'movie' | 'tv'
    const [sortBy, setSortBy] = useState("popular"); // 'popular' | 'newest' | 'rating'
    const [searchQuery, setSearchQuery] = useState("");
    const [isBioExpanded, setIsBioExpanded] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["person", id],
        queryFn: async () => {
            if (!id) throw new Error("Geçerli bir oyuncu kimliği belirtilmedi.");
            try {
                return await apiFetch(`/catalog/person/${id}`);
            } catch (err) {
                // Backend'de çift prefix varsa (/catalog/catalog/person/...) fallback dene
                try {
                    return await apiFetch(`/catalog/catalog/person/${id}`);
                } catch {
                    throw err;
                }
            }
        },
        staleTime: 1000 * 60 * 60 * 2, // 2 saat cache
        retry: 1,
    });

    useEffect(() => {
        if (data?.name) {
            document.title = `${data.name} - Filmografisi | CineWave`;
        }
        return () => {
            document.title = "CineWave - Film & Dizi Rehberi";
        };
    }, [data?.name]);

    // Filmografi listesini parse ve normalize et
    const { processedItems, totalStats } = useMemo(() => {
        if (!data) return { processedItems: [], totalStats: { total: 0, movies: 0, tv: 0 } };

        const rawCredits = data.credits || data.cast || data.combined_credits?.cast || [];

        // Tekrarlanan ID'leri ayıkla (Aynı yapımda birden fazla rol varsa)
        const uniqueMap = new Map();
        rawCredits.forEach((c) => {
            if (!c || !c.id) return;
            const key = `${c.media_type || (c.name ? "tv" : "movie")}_${c.id}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, c);
            }
        });

        const allList = Array.from(uniqueMap.values());
        const movieCount = allList.filter((c) => (c.media_type || "movie") === "movie").length;
        const tvCount = allList.filter((c) => (c.media_type || (c.name ? "tv" : "movie")) === "tv").length;

        // Filtreleme (Tür & Arama)
        let filtered = allList.filter((c) => {
            const mType = c.media_type || (c.name ? "tv" : "movie");
            if (mediaFilter !== "all" && mType !== mediaFilter) return false;

            if (searchQuery.trim()) {
                const title = (c.title || c.name || "").toLowerCase();
                const char = (c.character || "").toLowerCase();
                const q = searchQuery.toLowerCase().trim();
                return title.includes(q) || char.includes(q);
            }

            return true;
        });

        // Sıralama
        filtered.sort((a, b) => {
            if (sortBy === "popular") {
                return (b.popularity || 0) - (a.popularity || 0);
            }
            if (sortBy === "rating") {
                const rA = Number(a.vote_average ?? a.rating ?? 0);
                const rB = Number(b.vote_average ?? b.rating ?? 0);
                return rB - rA;
            }
            if (sortBy === "newest") {
                const dateA = a.release_date || a.first_air_date || "";
                const dateB = b.release_date || b.first_air_date || "";
                return dateB.localeCompare(dateA);
            }
            return 0;
        });

        // MovieGrid formatına adapt et
        const adapted = filtered.map((item) =>
            adaptCatalogCard({
                ...item,
                id: String(item.id),
                title: item.title || item.name,
                media_type: item.media_type || (item.name ? "tv" : "movie"),
                rating: item.vote_average ?? item.rating,
                year: (item.release_date || item.first_air_date || "").substring(0, 4),
            })
        );

        return {
            processedItems: adapted,
            totalStats: {
                total: allList.length,
                movies: movieCount,
                tv: tvCount,
            },
        };
    }, [data, mediaFilter, sortBy, searchQuery]);

    if (isLoading) {
        return (
            <div className="page-container animate-fade-in" style={{ padding: "40px 20px" }}>
                <div style={{ display: "flex", gap: "24px", marginBottom: "40px", alignItems: "center" }}>
                    <div style={{ width: "160px", height: "230px", borderRadius: "var(--radius-md)", background: "var(--bg-card)", animation: "pulse 1.5s infinite" }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ width: "300px", height: "36px", background: "var(--bg-card)", borderRadius: "8px", marginBottom: "12px", animation: "pulse 1.5s infinite" }} />
                        <div style={{ width: "180px", height: "20px", background: "var(--bg-card)", borderRadius: "6px", marginBottom: "16px", animation: "pulse 1.5s infinite" }} />
                        <div style={{ width: "100%", height: "60px", background: "var(--bg-card)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
                    </div>
                </div>
                <Skeleton count={8} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container animate-fade-in" style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎭</div>
                <h2 style={{ fontSize: "1.6rem", marginBottom: "12px" }}>Oyuncu Bilgisi Alınamadı</h2>
                <ErrorBox message={error.message || "Oyuncu detayları yüklenirken bir sorun oluştu."} />
                <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button onClick={() => navigate(-1)} className="btn-secondary">
                        ← Geri Dön
                    </button>
                    <Link to="/" className="btn-primary">
                        Ana Sayfaya Git
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const profileUrl = data.profile_path
        ? (data.profile_path.startsWith("http") ? data.profile_path : `https://image.tmdb.org/t/p/w500${data.profile_path}`)
        : FALLBACK_PROFILE;

    const bio = data.biography || "";
    const isBioLong = bio.length > 380;
    const displayedBio = isBioLong && !isBioExpanded ? `${bio.slice(0, 380)}...` : bio;

    return (
        <div className="page-container animate-fade-in">
            {/* Geri Dön Butonu */}
            <div style={{ marginBottom: "20px" }}>
                <button
                    onClick={() => navigate(-1)}
                    className="btn-secondary"
                    style={{ padding: "6px 14px", fontSize: "0.85rem", gap: "6px" }}
                >
                    <span>←</span>
                    <span>Geri Dön</span>
                </button>
            </div>

            {/* Oyuncu Bilgi Kartı (Hero) */}
            <div
                className="glass-panel"
                style={{
                    padding: "32px",
                    borderRadius: "var(--radius-lg)",
                    marginBottom: "36px",
                    display: "flex",
                    gap: "32px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                }}
            >
                {/* Profil Fotoğrafı */}
                <div style={{ width: "180px", flexShrink: 0, margin: "0 auto" }}>
                    <img
                        src={profileUrl}
                        alt={data.name}
                        onError={(e) => { e.currentTarget.src = FALLBACK_PROFILE; }}
                        style={{
                            width: "100%",
                            aspectRatio: "1 / 1.35",
                            objectFit: "cover",
                            borderRadius: "var(--radius-md)",
                            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.4)",
                            border: "1px solid var(--border-subtle)",
                        }}
                    />
                </div>

                {/* Bilgiler & Biyografi */}
                <div style={{ flex: 1, minWidth: "280px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                        <h1 style={{ fontSize: "2.3rem", fontWeight: 800, margin: 0, color: "#fff" }}>
                            {data.name}
                        </h1>
                        {data.known_for_department && (
                            <span
                                style={{
                                    fontSize: "0.82rem",
                                    padding: "4px 12px",
                                    background: "rgba(229, 9, 20, 0.15)",
                                    color: "var(--accent-red)",
                                    border: "1px solid rgba(229, 9, 20, 0.3)",
                                    borderRadius: "var(--radius-full)",
                                    fontWeight: 600,
                                }}
                            >
                                {data.known_for_department === "Acting" ? "Oyuncu" : data.known_for_department}
                            </span>
                        )}
                    </div>

                    {/* Doğum Tarihi & Doğum Yeri */}
                    <div style={{ display: "flex", gap: "16px", color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "16px", flexWrap: "wrap" }}>
                        {data.birthday && (
                            <span>
                                🎂 {new Date(data.birthday).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                        )}
                        {data.place_of_birth && (
                            <span>📍 {data.place_of_birth}</span>
                        )}
                        <span style={{ color: "var(--accent-gold)", fontWeight: 600 }}>
                            🎬 Toplam {totalStats.total} Yapım
                        </span>
                    </div>

                    {/* Biyografi */}
                    {bio ? (
                        <div>
                            <p style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: "0.96rem", margin: "0 0 8px 0" }}>
                                {displayedBio}
                            </p>
                            {isBioLong && (
                                <button
                                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--accent-red)",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        padding: 0,
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    {isBioExpanded ? "Daha Az Göster ↑" : "Devamını Oku ↓"}
                                </button>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.9rem" }}>
                            Bu oyuncu için henüz biyografi eklenmemiş.
                        </p>
                    )}
                </div>
            </div>

            {/* Filmografi Filtre & Kontrol Çubuğu */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginBottom: "24px",
                }}
            >
                {/* Tür Filtre Butonları */}
                <div style={{ display: "flex", gap: "8px", background: "var(--bg-card)", padding: "4px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <button
                        onClick={() => setMediaFilter("all")}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            background: mediaFilter === "all" ? "var(--accent-red)" : "transparent",
                            color: mediaFilter === "all" ? "#fff" : "var(--text-secondary)",
                            transition: "all var(--transition-fast)",
                        }}
                    >
                        Tümü ({totalStats.total})
                    </button>
                    <button
                        onClick={() => setMediaFilter("movie")}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            background: mediaFilter === "movie" ? "var(--accent-red)" : "transparent",
                            color: mediaFilter === "movie" ? "#fff" : "var(--text-secondary)",
                            transition: "all var(--transition-fast)",
                        }}
                    >
                        Filmler ({totalStats.movies})
                    </button>
                    <button
                        onClick={() => setMediaFilter("tv")}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "var(--radius-sm)",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            background: mediaFilter === "tv" ? "var(--accent-red)" : "transparent",
                            color: mediaFilter === "tv" ? "#fff" : "var(--text-secondary)",
                            transition: "all var(--transition-fast)",
                        }}
                    >
                        Diziler ({totalStats.tv})
                    </button>
                </div>

                {/* Sağ Kontroller: Arama ve Sıralama */}
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Hızlı Filmografi Arama */}
                    <input
                        type="text"
                        placeholder="Filmografide ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: "8px 14px",
                            fontSize: "0.9rem",
                            minWidth: "200px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-md)",
                            color: "#fff",
                        }}
                    />

                    {/* Sıralama Seçimi */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                            padding: "8px 14px",
                            fontSize: "0.9rem",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-md)",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        <option value="popular">En Popüler</option>
                        <option value="newest">En Yeni Yapımlar</option>
                        <option value="rating">En Yüksek Puanlı</option>
                    </select>
                </div>
            </div>

            {/* Filmografi Başlığı */}
            <div className="page-header" style={{ marginBottom: "20px" }}>
                <h2 style={{ fontSize: "1.4rem", margin: 0 }}>
                    <span>🎬</span>
                    <span>
                        {data.name} Yapımları ({processedItems.length})
                    </span>
                </h2>
            </div>

            {/* Yapım Listesi (Grid) */}
            {processedItems.length === 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "60px 20px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                    }}
                >
                    <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
                    <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Eşleşen Yapım Bulunamadı</h3>
                    <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                        Arama veya filtre kriterlerinize uyan bir yapım bulunmuyor.
                    </p>
                </div>
            ) : (
                <MovieGrid items={processedItems} />
            )}
        </div>
    );
}
