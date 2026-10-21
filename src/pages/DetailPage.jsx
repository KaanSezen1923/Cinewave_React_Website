import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, getTvSeasonDetail } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useFavoriteIds } from "../hooks/useFavoriteIds";
import { useToggleFavorite } from "../hooks/useToggleFavorite";
import { Skeleton } from "../components/Skeleton";
import { ErrorBox } from "../components/ErrorBox";
import { MovieGrid } from "../components/MovieGrid";
import { adaptCatalogCard } from "../utils/adapters";
import { buildProviderUrl, dedupeProviders, indexDirectLinks } from "../utils/providerLinks";

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect width="500" height="750" fill="%23151824"/><circle cx="250" cy="330" r="50" fill="none" stroke="%23334155" stroke-width="6"/><path d="M235 310 L275 330 L235 350 Z" fill="%23475569"/><text x="50%" y="430" font-family="-apple-system,sans-serif" font-size="20" font-weight="600" fill="%2364748b" text-anchor="middle">Afiş Bulunamadı</text></svg>`;

const FALLBACK_STILL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%23141824"/><circle cx="160" cy="82" r="24" fill="none" stroke="%23334155" stroke-width="3"/><path d="M153 72 L173 82 L153 92 Z" fill="%23475569"/><text x="50%" y="135" font-family="-apple-system,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Bölüm Görseli Yok</text></svg>`;

function formatTurkishDate(dateStr) {
    if (!dateStr) return "";
    try {
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) return dateStr;
        return dt.toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

export default function DetailPage({ mediaType }) {
    const { id } = useParams();
    const rawId = decodeURIComponent(id || "").trim();
    const location = useLocation();
    const passedMediaType = location.state?.mediaType;
    const expectedTitle = location.state?.title;
    const { user } = useAuth();

    const { data: favoriteIds = [], refetch: refetchFavoriteIds } = useFavoriteIds();
    useToggleFavorite();

    const [selectedSeason, setSelectedSeason] = useState(null);
    const [episodeSearch, setEpisodeSearch] = useState("");

    // Detay verisini çekme (Hem sayısal TMDB ID'leri hem de favorilerden gelen film adlarını destekler)
    const { data, isLoading, error } = useQuery({
        queryKey: ["detail", mediaType, rawId, passedMediaType],
        queryFn: async () => {
            if (!rawId) throw new Error("Geçerli bir içerik kimliği belirtilmedi.");

            let targetId = rawId;
            let targetMediaType = passedMediaType || mediaType || "movie";

            // LocalStorage'daki media_type haritasını kontrol et
            try {
                const types = JSON.parse(localStorage.getItem("cinewave_media_types") || "{}");
                if (types[rawId]) {
                    targetMediaType = types[rawId];
                }
            } catch { }

            // Eğer ID sayısal değilse (örneğin favorilerde film adı kayıtlıysa), TMDB'de ara
            if (!/^\d+$/.test(rawId)) {
                const searchRes = await apiFetch(`/catalog/search?q=${encodeURIComponent(rawId)}`);
                const firstMatch = searchRes.results?.[0];
                if (!firstMatch || !firstMatch.id) {
                    throw new Error(`"${rawId}" başlıklı yapım bulunamadı.`);
                }
                targetId = String(firstMatch.id);
                if (firstMatch.media_type) {
                    targetMediaType = firstMatch.media_type;
                }
            }

            // Sayısal TMDB ID ile detay endpoint'ini çağır
            let detailData = null;
            try {
                detailData = await apiFetch(`/catalog/${targetMediaType}/${targetId}`);
            } catch (err) {
                // Eğer ilk deneme başarısızsa alternatif medyayı dene (movie <-> tv)
                const fallbackMediaType = targetMediaType === "movie" ? "tv" : "movie";
                try {
                    detailData = await apiFetch(`/catalog/${fallbackMediaType}/${targetId}`);
                    targetMediaType = fallbackMediaType;
                } catch {
                    throw err;
                }
            }

            // Akıllı Başlık Doğrulaması
            if (expectedTitle && detailData) {
                const fetchedTitle = (detailData.title || detailData.name || "").toLowerCase().trim();
                const cleanExpected = expectedTitle.toLowerCase().trim();
                const isMatch =
                    fetchedTitle === cleanExpected ||
                    fetchedTitle.includes(cleanExpected) ||
                    cleanExpected.includes(fetchedTitle);

                if (!isMatch) {
                    const altMediaType = targetMediaType === "movie" ? "tv" : "movie";
                    try {
                        const altData = await apiFetch(`/catalog/${altMediaType}/${targetId}`);
                        const altTitle = (altData.title || altData.name || "").toLowerCase().trim();
                        if (
                            altTitle === cleanExpected ||
                            altTitle.includes(cleanExpected) ||
                            cleanExpected.includes(altTitle)
                        ) {
                            detailData = altData;
                            targetMediaType = altMediaType;
                        }
                    } catch {
                        // alternatif yoksa mevcutla devam et
                    }
                }
            }

            // Başarıyla çözülen media_type'ı sonraki ziyaretler için kaydet
            try {
                const types = JSON.parse(localStorage.getItem("cinewave_media_types") || "{}");
                types[targetId] = targetMediaType;
                localStorage.setItem("cinewave_media_types", JSON.stringify(types));
            } catch { }

            return {
                ...detailData,
                resolvedId: targetId,
                resolvedMediaType: targetMediaType,
            };
        },
        staleTime: 1000 * 60 * 30,
        retry: 1,
    });

    const activeId = data?.resolvedId || data?.id;
    const activeMediaType = data?.resolvedMediaType || mediaType || "movie";
    const seasons = data?.seasons || [];

    // Dizi yüklendiğinde varsayılan olarak 1. sezonu (veya mevcut ilk sezonu) seç
    useEffect(() => {
        if (activeMediaType === "tv" && seasons.length > 0) {
            const firstRegularSeason =
                seasons.find((s) => Number(s.season_number) > 0) || seasons[0];
            setSelectedSeason(firstRegularSeason?.season_number ?? null);
            setEpisodeSearch("");
        } else {
            setSelectedSeason(null);
        }
    }, [activeId, activeMediaType, seasons.length]);

    // Seçili sezonun bölüm rehberini çekme (GET /catalog/tv/{id}/season/{season_number})
    const {
        data: seasonDetail,
        isLoading: isSeasonLoading,
        error: seasonError,
    } = useQuery({
        queryKey: ["tv-season", activeId, selectedSeason],
        queryFn: () => getTvSeasonDetail(activeId, selectedSeason),
        staleTime: 1000 * 60 * 30,
        enabled:
            activeMediaType === "tv" &&
            !!activeId &&
            /^\d+$/.test(String(activeId)) &&
            selectedSeason !== null &&
            selectedSeason !== undefined,
    });

    // Benzer yapımları çekme
    const { data: similarData } = useQuery({
        queryKey: ["similar", activeMediaType, activeId],
        queryFn: () => apiFetch(`/catalog/${activeMediaType}/${activeId}/similar`),
        staleTime: 1000 * 60 * 60,
        enabled: !!activeId && /^\d+$/.test(String(activeId)),
    });

    // Platformlardaki doğrudan başlık linkleri (backend /watch-links)
    const { data: watchLinks } = useQuery({
        queryKey: ["watch-links", activeMediaType, activeId],
        queryFn: () => apiFetch(`/catalog/${activeMediaType}/${activeId}/watch-links`),
        staleTime: 1000 * 60 * 60 * 24,
        retry: 0,
        enabled: !!activeId && /^\d+$/.test(String(activeId)),
    });

    if (isLoading) {
        return (
            <div className="page-container animate-fade-in" style={{ padding: "40px 20px", textAlign: "center" }}>
                <Skeleton count={1} />
                <p style={{ marginTop: "24px", color: "var(--text-secondary)", fontSize: "1.1rem" }}>
                    İçerik detayları yükleniyor...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-container animate-fade-in" style={{ maxWidth: "650px", margin: "60px auto", textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔍</div>
                <h2 style={{ fontSize: "1.6rem", marginBottom: "12px" }}>Yapım Detayı Yüklenemedi</h2>
                <ErrorBox message={error.message} />
                <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
                    <Link to="/favorites" className="btn-secondary">← Favorilerime Dön</Link>
                    <Link to="/discover" className="btn-primary">Keşfet'e Git</Link>
                </div>
            </div>
        );
    }

    if (!data) return null;

    // Favori durumu kontrolü
    const isFavorite =
        favoriteIds.includes(String(activeId)) ||
        favoriteIds.includes(String(rawId)) ||
        favoriteIds.includes(String(data.title));

    // Backend'in normalize ettiği veriler + TMDB ham alanları için akıllı fallback
    const title = data.title || data.name || rawId;
    const year = data.year || (data.release_date || data.first_air_date || "").substring(0, 4);
    const posterUrl = data.poster || (data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : FALLBACK_POSTER);
    const backdropUrl = data.backdrop || (data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : "");
    const rating = data.rating ?? (data.vote_average ? data.vote_average.toFixed(1) : "N/A");
    const runtime = data.runtime ? `${data.runtime} dk` : "";
    const genres = data.genres || [];
    const directors = data.directors || (data.credits?.crew?.filter(c => c.job === "Director").map(c => c.name)) || [];
    const cast = data.cast || data.credits?.cast?.slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character,
        photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    })) || [];
    const trailerKey = data.trailer || data.videos?.results?.find(v => v.site === "YouTube" && v.type === "Trailer")?.key;
    const providers = dedupeProviders(
        data.providers?.flatrate || data["watch/providers"]?.results?.TR?.flatrate || []
    );
    const justWatchLink = data["watch/providers"]?.results?.TR?.link || data.providers?.link;
    const directLinks = indexDirectLinks(watchLinks?.options);
    const similarItems = (similarData?.results || []).map(adaptCatalogCard);

    const rawEpisodes = seasonDetail?.episodes || [];
    const filteredEpisodes = episodeSearch.trim()
        ? rawEpisodes.filter((ep) => {
            const q = episodeSearch.toLowerCase();
            return (
                String(ep.episode_number).includes(q) ||
                (ep.name || "").toLowerCase().includes(q) ||
                (ep.overview || "").toLowerCase().includes(q)
            );
        })
        : rawEpisodes;

    const handleSeasonClick = (seasonNumber) => {
        setSelectedSeason((prev) => (prev === seasonNumber ? null : seasonNumber));
        setEpisodeSearch("");
    };

    const handleFavClick = async () => {
        if (!user) return alert("Favorilere eklemek için giriş yapmalısınız.");
        try {
            const itemId = String(activeId);
            try {
                const types = JSON.parse(localStorage.getItem("cinewave_media_types") || "{}");
                if (isFavorite) {
                    delete types[itemId];
                    delete types[String(rawId)];
                } else {
                    types[itemId] = activeMediaType;
                }
                localStorage.setItem("cinewave_media_types", JSON.stringify(types));
            } catch { }

            if (isFavorite) {
                const idToDelete = favoriteIds.includes(String(rawId)) ? rawId : itemId;
                await apiFetch(`/favorites/${encodeURIComponent(idToDelete)}`, { method: "DELETE" });
            } else {
                await apiFetch("/favorites", {
                    method: "POST",
                    body: JSON.stringify({
                        movie_id: String(activeId),
                        title: title,
                        genres: genres.map(g => g.name).join(", "),
                        director: directors.join(", "),
                        poster_url: posterUrl,
                        imdb_rating: String(rating),
                        media_type: activeMediaType,
                    }),
                });
            }
            refetchFavoriteIds();
        } catch (err) {
            alert("İşlem başarısız: " + err.message);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            {/* Detay Kartı / Hero */}
            <div className="detail-hero">
                {backdropUrl && (
                    <div
                        className="detail-bg-art"
                        style={{ backgroundImage: `url(${backdropUrl})` }}
                    />
                )}

                <div className="detail-poster-wrap">
                    <img
                        src={posterUrl}
                        alt={title}
                        className="detail-poster"
                        onError={(e) => { e.currentTarget.src = FALLBACK_POSTER; }}
                    />
                </div>

                <div className="detail-body">
                    <h1 style={{ fontSize: "2.4rem", marginBottom: "8px" }}>
                        {title} {year ? `(${year})` : ""}
                    </h1>

                    {data.tagline && (
                        <p style={{ fontStyle: "italic", color: "var(--text-secondary)", marginBottom: "12px", fontSize: "1.05rem" }}>
                            "{data.tagline}"
                        </p>
                    )}

                    <div className="detail-badges">
                        <span className="rating-badge" style={{ fontSize: "0.95rem", padding: "6px 12px" }}>
                            ★ {rating}
                        </span>
                        {genres.map(g => (
                            <span key={g.id || g.name} className="detail-genre-pill">
                                {g.name}
                            </span>
                        ))}
                        {runtime && <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>⏱ {runtime}</span>}
                        {activeMediaType === "tv" && data.number_of_seasons && (
                            <span className="detail-genre-pill">
                                📺 {data.number_of_seasons} Sezon • {data.number_of_episodes || "?"} Bölüm
                            </span>
                        )}
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: "8px", color: "var(--text-primary)" }}>Özet</h3>
                        <p style={{ lineHeight: "1.7", color: "#cbd5e1" }}>
                            {data.overview || "Bu yapım için henüz Türkçe özet eklenmemiş."}
                        </p>
                    </div>

                    {directors.length > 0 && (
                        <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
                            <strong style={{ color: "white" }}>
                                {activeMediaType === "tv" ? "Yaratıcı / Yönetmen: " : "Yönetmen: "}
                            </strong>
                            {directors.join(", ")}
                        </p>
                    )}

                    <div style={{ marginTop: "auto", paddingTop: "16px" }}>
                        <button
                            onClick={handleFavClick}
                            className={isFavorite ? "btn-secondary" : "btn-primary"}
                            style={{ gap: "10px", padding: "12px 24px", fontSize: "0.95rem" }}
                        >
                            <span>{isFavorite ? "❤️ Favorilerden Çıkar" : "🤍 Favorilere Ekle"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Nereden İzlenir? */}
            {providers.length > 0 && (
                <section style={{ marginBottom: "40px" }}>
                    <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>📺</span> Türkiye'de Nereden İzlenir?
                    </h3>
                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                        {providers.map((p) => {
                            const pName = p.name || p.provider_name || "Platform";
                            const pId = p.provider_id ?? p.id;
                            const pLogo = p.logo
                                ? (p.logo.startsWith("http") ? p.logo : `https://image.tmdb.org/t/p/w92${p.logo}`)
                                : (p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null);
                            const targetUrl = buildProviderUrl(
                                { id: pId, name: pName },
                                { title, year, mediaType: activeMediaType, justWatchLink, directLinks }
                            );

                            return (
                                <a
                                    key={pId ?? pName}
                                    href={targetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="provider-badge-link"
                                    title={`${pName} üzerinde "${title}" ara ve izle (Yeni sekmede açılır)`}
                                >
                                    {pLogo && <img src={pLogo} alt="" style={{ width: "28px", height: "28px", borderRadius: "6px" }} />}
                                    <span>{pName}</span>
                                    <span className="provider-arrow">↗</span>
                                </a>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Oyuncu Kadrosu */}
            {cast.length > 0 && (
                <section style={{ marginBottom: "40px" }}>
                    <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>🎭</span> Oyuncular
                    </h3>
                    <div className="cast-slider">
                        {cast.map((actor) => (
                            <Link
                                key={actor.id}
                                to={`/oyuncu/${actor.id}`}
                                className="cast-card"
                                style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
                                title={`${actor.name} - Tüm yapımlarını incele`}
                            >
                                <img
                                    src={actor.photo || actor.profile_path ? (actor.photo || `https://image.tmdb.org/t/p/w185${actor.profile_path}`) : FALLBACK_POSTER}
                                    alt={actor.name}
                                    className="cast-photo"
                                    onError={(e) => { e.currentTarget.src = FALLBACK_POSTER; }}
                                />
                                <div style={{ padding: "8px" }}>
                                    <p style={{ fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {actor.name}
                                    </p>
                                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {actor.character}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Dizi Sezon ve Bölüm Rehberi (İnteraktif Sezon Seçici + Akordeon Bölüm Listesi) */}
            {activeMediaType === "tv" && seasons.length > 0 && (
                <section style={{ marginBottom: "44px" }}>
                    <div className="season-guide-header">
                        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                            <span>📑</span> Sezon ve Bölüm Rehberi
                        </h3>
                        <span className="season-guide-hint">
                            Bölüm özetlerini ve görsellerini görmek için bir sezona tıklayın
                        </span>
                    </div>

                    {/* Tıklanabilir Sezon Kartları */}
                    <div className="season-cards-strip">
                        {seasons.map((season) => {
                            const isSelected = selectedSeason === season.season_number;
                            return (
                                <button
                                    key={season.season_number}
                                    type="button"
                                    onClick={() => handleSeasonClick(season.season_number)}
                                    className={`season-selector-card ${isSelected ? "active" : ""}`}
                                    aria-expanded={isSelected}
                                >
                                    {season.poster && (
                                        <img
                                            src={season.poster}
                                            alt={season.name}
                                            className="season-selector-poster"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                            }}
                                        />
                                    )}
                                    <div className="season-selector-info">
                                        <div className="season-selector-top">
                                            <strong>{season.name}</strong>
                                            <span className="season-selector-chevron">
                                                {isSelected ? "▾" : "▸"}
                                            </span>
                                        </div>
                                        <p className="season-selector-count">
                                            {season.episode_count} Bölüm
                                        </p>
                                        {season.air_date && (
                                            <small className="season-selector-year">
                                                {season.air_date.substring(0, 4)}
                                            </small>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Seçili Sezonun Bölüm Listesi (Akordeon Paneli) */}
                    {selectedSeason !== null && (
                        <div className="season-episodes-panel animate-fade-in">
                            {isSeasonLoading ? (
                                <div className="season-loading-box">
                                    <div className="autocomplete-mini-spinner" />
                                    <span>Sezon bölümleri yükleniyor...</span>
                                </div>
                            ) : seasonError ? (
                                <ErrorBox message={seasonError.message} />
                            ) : seasonDetail ? (
                                <>
                                    <div className="season-panel-top">
                                        <div>
                                            <div className="season-panel-title-row">
                                                <h4>{seasonDetail.name || `${selectedSeason}. Sezon`}</h4>
                                                <span className="season-episode-total-badge">
                                                    {rawEpisodes.length} Bölüm
                                                </span>
                                            </div>
                                            {seasonDetail.overview && (
                                                <p className="season-panel-overview">
                                                    {seasonDetail.overview}
                                                </p>
                                            )}
                                        </div>

                                        <div className="season-panel-actions">
                                            {rawEpisodes.length > 5 && (
                                                <input
                                                    type="text"
                                                    value={episodeSearch}
                                                    onChange={(e) => setEpisodeSearch(e.target.value)}
                                                    placeholder="Bölüm ara..."
                                                    className="episode-filter-input"
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSeason(null)}
                                                className="season-close-btn"
                                                title="Bölüm rehberini kapat"
                                            >
                                                ✕ Kapat
                                            </button>
                                        </div>
                                    </div>

                                    {filteredEpisodes.length === 0 ? (
                                        <p style={{ color: "var(--text-muted)", padding: "16px 0" }}>
                                            Aramanızla eşleşen bölüm bulunamadı.
                                        </p>
                                    ) : (
                                        <div className="episodes-list">
                                            {filteredEpisodes.map((ep) => (
                                                <article
                                                    key={ep.episode_number}
                                                    className="episode-card"
                                                >
                                                    <div className="episode-still-wrap">
                                                        <img
                                                            src={ep.still || FALLBACK_STILL}
                                                            alt={`${ep.episode_number}. Bölüm: ${ep.name}`}
                                                            className="episode-still-img"
                                                            loading="lazy"
                                                            onError={(e) => {
                                                                e.currentTarget.src = FALLBACK_STILL;
                                                            }}
                                                        />
                                                        <span className="episode-number-badge">
                                                            {ep.episode_number}. Bölüm
                                                        </span>
                                                    </div>

                                                    <div className="episode-card-body">
                                                        <div className="episode-card-header">
                                                            <h5 className="episode-title">
                                                                {ep.name || `${ep.episode_number}. Bölüm`}
                                                            </h5>
                                                            <div className="episode-meta-badges">
                                                                {ep.rating > 0 && (
                                                                    <span className="rating-badge">
                                                                        ★ {Number(ep.rating).toFixed(1)}
                                                                    </span>
                                                                )}
                                                                {ep.runtime && (
                                                                    <span className="episode-meta-pill">
                                                                        ⏱ {ep.runtime} dk
                                                                    </span>
                                                                )}
                                                                {ep.air_date && (
                                                                    <span className="episode-meta-pill">
                                                                        📅 {formatTurkishDate(ep.air_date)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <p className="episode-overview">
                                                            {ep.overview ||
                                                                "Bu bölüm için henüz Türkçe özet eklenmemiş."}
                                                        </p>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    )}
                </section>
            )}

            {/* Fragman (YouTube) */}
            {trailerKey && (
                <section style={{ marginBottom: "50px" }}>
                    <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>🎬</span> Fragman
                    </h3>
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                        <iframe
                            src={`https://www.youtube.com/embed/${trailerKey}`}
                            title={`${title} Fragmanı`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        />
                    </div>
                </section>
            )}

            {/* Benzer Yapımlar */}
            {similarItems.length > 0 && (
                <section style={{ marginBottom: "40px" }}>
                    <div className="page-header">
                        <h3 style={{ fontSize: "1.4rem" }}>
                            Benzer {activeMediaType === "tv" ? "Diziler" : "Filmler"}
                        </h3>
                    </div>
                    <MovieGrid items={similarItems.slice(0, 10)} />
                </section>
            )}
        </div>
    );
}