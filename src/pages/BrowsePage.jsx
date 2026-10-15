import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { adaptCatalogCard } from "../utils/adapters";
import { MovieGrid } from "../components/MovieGrid";
import { Skeleton } from "../components/Skeleton";
import { ErrorBox } from "../components/ErrorBox";
import SearchAutocomplete from "../components/SearchAutocomplete";

export default function BrowsePage({ mediaType }) {
    const [searchParams, setSearchParams] = useSearchParams();

    // URL'den parametreleri okuma (Varsayılan değerlerle)
    const page = parseInt(searchParams.get("page") || "1", 10);
    const genre = searchParams.get("genre") || "";
    const sort = searchParams.get("sort") || "popular";
    const query = searchParams.get("query") || "";

    // Tür listesini çekme
    const { data: rawGenres } = useQuery({
        queryKey: ["genres", mediaType],
        queryFn: () => apiFetch(`/catalog/genres?media_type=${mediaType}`),
        staleTime: 1000 * 60 * 60 * 24, // 1 gün cache
    });

    const genresList = Array.isArray(rawGenres) ? rawGenres : (rawGenres?.genres || []);

    // İçerik listesini çekme (Arama veya Gözatma)
    const { data: contentData, isLoading, error } = useQuery({
        queryKey: ["content", mediaType, page, genre, sort, query],
        queryFn: async () => {
            let endpoint = "";
            if (query) {
                // catalog.py q parametresi bekler
                endpoint = `/catalog/search?q=${encodeURIComponent(query)}&page=${page}`;
            } else {
                const params = new URLSearchParams({
                    media_type: mediaType,
                    page: page.toString(),
                    sort: sort, // popular | rating | newest
                });
                if (genre) params.append("genre", genre);
                endpoint = `/catalog/browse?${params.toString()}`;
            }

            const response = await apiFetch(endpoint);
            return {
                results: (response.results || []).map(item => adaptCatalogCard({ ...item, media_type: item.media_type || mediaType })),
                totalPages: response.total_pages || 1,
            };
        },
        keepPreviousData: true,
    });

    // Parametre güncelleyici yardımcı fonksiyon
    const updateParams = (newParams) => {
        const current = Object.fromEntries([...searchParams]);
        setSearchParams({ ...current, ...newParams, page: newParams.page || "1" });
    };

    const handleSearch = (q) => {
        updateParams({ query: q, genre: "" });
    };

    const pageTitle = mediaType === "movie" ? "Filmler" : "Diziler";

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">
                    <span>{mediaType === "movie" ? "🎬" : "📺"}</span>
                    <span>{pageTitle}</span>
                </h1>
            </div>

            {/* Kontrol Paneli (Arama ve Filtreler) */}
            <div className="filter-bar">
                <SearchAutocomplete
                    initialValue={query}
                    mediaType={mediaType}
                    placeholder={mediaType === "movie" ? "Film ara... (örn: Matrix, Inception)" : "Dizi ara... (örn: Breaking Bad, Dark)"}
                    onSearch={handleSearch}
                    variant="page"
                />

                {!query && (
                    <>
                        <select
                            value={genre}
                            onChange={(e) => updateParams({ genre: e.target.value })}
                            className="filter-select"
                        >
                            <option value="">Tüm Türler</option>
                            {genresList.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>

                        <select
                            value={sort}
                            onChange={(e) => updateParams({ sort: e.target.value })}
                            className="filter-select"
                        >
                            <option value="popular">En Popüler</option>
                            <option value="rating">En Yüksek Puan</option>
                            <option value="newest">En Yeniler</option>
                        </select>
                    </>
                )}

                {query && (
                    <button
                        onClick={() => updateParams({ query: "" })}
                        className="btn-secondary"
                    >
                        ✕ Aramayı Temizle
                    </button>
                )}
            </div>

            {/* İçerik Alanı */}
            {error ? (
                <ErrorBox message={error.message} />
            ) : isLoading ? (
                <Skeleton count={12} />
            ) : (
                <MovieGrid items={contentData?.results} />
            )}

            {/* Sayfalama */}
            {contentData?.totalPages > 1 && (
                <div className="pagination">
                    <button
                        disabled={page <= 1}
                        onClick={() => updateParams({ page: (page - 1).toString() })}
                        className="pagination-btn"
                    >
                        ← Önceki
                    </button>
                    <span className="pagination-info">
                        Sayfa <strong>{page}</strong> / {contentData.totalPages}
                    </span>
                    <button
                        disabled={page >= contentData.totalPages}
                        onClick={() => updateParams({ page: (page + 1).toString() })}
                        className="pagination-btn"
                    >
                        Sonraki →
                    </button>
                </div>
            )}
        </div>
    );
}