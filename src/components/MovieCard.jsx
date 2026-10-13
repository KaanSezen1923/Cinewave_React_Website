import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToggleFavorite } from "../hooks/useToggleFavorite";
import { useFavoriteIds } from "../hooks/useFavoriteIds";

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect width="500" height="750" fill="%23151824"/><circle cx="250" cy="330" r="50" fill="none" stroke="%23334155" stroke-width="6"/><path d="M235 310 L275 330 L235 350 Z" fill="%23475569"/><text x="50%" y="430" font-family="-apple-system,sans-serif" font-size="20" font-weight="600" fill="%2364748b" text-anchor="middle">Afiş Bulunamadı</text></svg>`;

export function MovieCard({ item }) {
    const { user } = useAuth();
    const [imgError, setImgError] = useState(false);

    const { data: favoriteIds = [] } = useFavoriteIds();
    const { mutate: toggleFavorite } = useToggleFavorite();

    if (!item || !item.id) return null;

    const isFavorite = favoriteIds.includes(String(item.id));
    const targetPath = item.mediaType === "tv" ? `/dizi/${item.id}` : `/film/${item.id}`;
    const displayPoster = (!imgError && item.posterUrl) ? item.posterUrl : FALLBACK_POSTER;

    const handleHeartClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite({ item, isFavorite });
    };

    return (
        <div className="movie-card">
            {user && (
                <button
                    onClick={handleHeartClick}
                    className={`fav-btn ${isFavorite ? "is-favorite" : ""}`}
                    title={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                    aria-label="Favori"
                >
                    <span style={{ fontSize: "16px" }}>{isFavorite ? "❤️" : "🤍"}</span>
                </button>
            )}

            <Link to={targetPath} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", height: "100%" }}>
                <div className="movie-poster-wrap">
                    <img
                        src={displayPoster}
                        alt={item.title || "Film Afişi"}
                        onError={() => setImgError(true)}
                        loading="lazy"
                        className="movie-poster"
                    />
                    <div className="movie-poster-overlay" />
                </div>

                <div className="movie-card-info">
                    <h4 className="movie-card-title" title={item.title}>
                        {item.title}
                    </h4>
                    <div className="movie-card-meta">
                        <span>{item.year || (item.mediaType === "tv" ? "Dizi" : "Film")}</span>
                        <span className="rating-badge">
                            ★ {item.rating && item.rating !== "undefined" ? item.rating : "N/A"}
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    );
}
export default MovieCard;