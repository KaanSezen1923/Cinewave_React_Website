import { MovieCard } from "./MovieCard";

export function MovieGrid({ items, onToggleFavorite }) {
    if (!items || items.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                <p style={{ fontSize: "1.1rem" }}>Aradığınız kriterlere uygun içerik bulunamadı.</p>
            </div>
        );
    }

    return (
        <div className="movie-grid">
            {items.map((item) => (
                <MovieCard
                    key={`${item.mediaType || "media"}-${item.id}`}
                    item={item}
                    onToggleFavorite={onToggleFavorite}
                />
            ))}
        </div>
    );
}
export default MovieGrid;