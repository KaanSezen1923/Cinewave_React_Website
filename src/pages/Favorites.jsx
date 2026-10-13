import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { MovieGrid } from "../components/MovieGrid";
import { adaptFavoriteCard } from "../utils/adapters";
import { Skeleton } from "../components/Skeleton";
import { ErrorBox } from "../components/ErrorBox";

export default function Favorites() {
    const [page, setPage] = useState(1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { data, isLoading, error } = useQuery({
        queryKey: ["favorites", limit, offset],
        queryFn: async () => {
            const res = await apiFetch(`/favorites?limit=${limit}&offset=${offset}`);
            return {
                items: (res.favorites || []).map(adaptFavoriteCard),
                total: res.total || 0,
            };
        },
        keepPreviousData: true,
    });

    if (error) {
        return (
            <div className="page-container">
                <ErrorBox message={error.message} />
            </div>
        );
    }

    const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
    const hasFavorites = data?.items && data.items.length > 0;

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">
                    <span>❤️</span>
                    <span>Favorilerim</span>
                </h1>
                {data && (
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                        Toplam {data.total} yapım
                    </span>
                )}
            </div>

            {isLoading ? (
                <Skeleton count={8} />
            ) : !hasFavorites ? (
                <div style={{
                    textAlign: "center",
                    padding: "80px 20px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    maxWidth: "600px",
                    margin: "40px auto"
                }}>
                    <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎬</div>
                    <h2 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>Henüz Favorin Yok</h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: "28px", lineHeight: "1.6" }}>
                        Gözüne çarpan film ve dizilerdeki kalp simgesine basarak buraya ekleyebilirsin.
                    </p>
                    <Link to="/discover" className="btn-primary" style={{ padding: "12px 28px" }}>
                        ✨ Hemen Keşfet
                    </Link>
                </div>
            ) : (
                <>
                    <MovieGrid items={data.items} />

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="pagination-btn"
                            >
                                ← Önceki
                            </button>
                            <span className="pagination-info">
                                Sayfa <strong>{page}</strong> / {totalPages}
                            </span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="pagination-btn"
                            >
                                Sonraki →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}