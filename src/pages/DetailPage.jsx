import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useFavoriteIds } from "../hooks/useFavoriteIds";
import { useToggleFavorite } from "../hooks/useToggleFavorite";
import { Skeleton } from "../components/Skeleton";
import { ErrorBox } from "../components/ErrorBox";
import { MovieGrid } from "../components/MovieGrid";
import { adaptCatalogCard } from "../utils/adapters";

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect width="500" height="750" fill="%23151824"/><circle cx="250" cy="330" r="50" fill="none" stroke="%23334155" stroke-width="6"/><path d="M235 310 L275 330 L235 350 Z" fill="%23475569"/><text x="50%" y="430" font-family="-apple-system,sans-serif" font-size="20" font-weight="600" fill="%2364748b" text-anchor="middle">Afiş Bulunamadı</text></svg>`;

export default function DetailPage({ mediaType }) {
    const { id } = useParams();
    const rawId = decodeURIComponent(id || "").trim();
    const location = useLocation();
    const passedMediaType = location.state?.mediaType;
    const expectedTitle = location.state?.title;
    const { user } = useAuth();

    const { data: favoriteIds = [], refetch: refetchFavoriteIds } = useFavoriteIds();
    const { mutate: toggleFavorite } = useToggleFavorite();

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

            // Akıllı Başlık Doğrulaması:
            // Eğer favorilerden bir başlık aktarılmışsa ve gelen yapımın başlığı uyuşmuyorsa,
            // diğer medyayı (örn. /catalog/tv/{id}) kontrol et
            if (expectedTitle && detailData) {
                const fetchedTitle = (detailData.title || detailData.name || "").toLowerCase().trim();
                const cleanExpected = expectedTitle.toLowerCase().trim();
                const isMatch = fetchedTitle === cleanExpected ||
                    fetchedTitle.includes(cleanExpected) ||
                    cleanExpected.includes(fetchedTitle);

                if (!isMatch) {
                    const altMediaType = targetMediaType === "movie" ? "tv" : "movie";
                    try {
                        const altData = await apiFetch(`/catalog/${altMediaType}/${targetId}`);
                        const altTitle = (altData.title || altData.name || "").toLowerCase().trim();
                        if (altTitle === cleanExpected || altTitle.includes(cleanExpected) || cleanExpected.includes(altTitle)) {
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

    // Benzer yapımları çekme
    const { data: similarData } = useQuery({
        queryKey: ["similar", activeMediaType, activeId],
        queryFn: () => apiFetch(`/catalog/${activeMediaType}/${activeId}/similar`),
        staleTime: 1000 * 60 * 60,
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

    // Favori durumu kontrolü (hem sayısal ID hem de orijinal rawId ile eşleşme)
    const isFavorite = favoriteIds.includes(String(activeId)) ||
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
    const providers = data.providers?.flatrate || data["watch/providers"]?.results?.TR?.flatrate || [];
    const seasons = data.seasons || [];
    const similarItems = (similarData?.results || []).map(adaptCatalogCard);

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
                // Veritabanında rawId veya activeId kayıtlı olabilir
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
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: "8px", color: "var(--text-primary)" }}>Özet</h3>
                        <p style={{ lineHeight: "1.7", color: "#cbd5e1" }}>
                            {data.overview || "Bu yapım için henüz Türkçe özet eklenmemiş."}
                        </p>
                    </div>

                    {directors.length > 0 && (
                        <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
                            <strong style={{ color: "white" }}>Yönetmen: </strong>
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
                        {providers.map((p, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px 16px",
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)"
                                }}
                            >
                                {p.logo && <img src={p.logo} alt={p.name} style={{ width: "28px", height: "28px", borderRadius: "6px" }} />}
                                <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{p.name}</span>
                            </div>
                        ))}
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

            {/* Dizi Sezonları */}
            {activeMediaType === "tv" && seasons.length > 0 && (
                <section style={{ marginBottom: "40px" }}>
                    <h3 style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>📑</span> Sezonlar
                    </h3>
                    <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "12px" }}>
                        {seasons.map((season) => (
                            <div
                                key={season.season_number}
                                style={{
                                    minWidth: "160px",
                                    padding: "16px",
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-md)",
                                }}
                            >
                                <strong style={{ fontSize: "1rem" }}>{season.name}</strong>
                                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "6px" }}>
                                    {season.episode_count} Bölüm
                                </p>
                                {season.air_date && (
                                    <small style={{ color: "var(--text-muted)" }}>{season.air_date.substring(0, 4)}</small>
                                )}
                            </div>
                        ))}
                    </div>
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