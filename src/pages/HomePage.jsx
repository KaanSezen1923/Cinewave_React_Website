import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCatalogHome } from "../api/api";
import { adaptCatalogCard } from "../utils/adapters";
import { MovieCard } from "../components/MovieCard";
import { Skeleton } from "../components/Skeleton";
import { ErrorBox } from "../components/ErrorBox";
import SearchAutocomplete from "../components/SearchAutocomplete";
import BrowsePage from "./BrowsePage";
import { useAuth } from "../context/AuthContext";
import { useFavoriteIds } from "../hooks/useFavoriteIds";
import { useToggleFavorite } from "../hooks/useToggleFavorite";

const CAROUSEL_SECTIONS = [
    {
        key: "trending",
        title: "Haftanın Trendleri",
        icon: "🔥",
        subtitle: "Bu hafta sinema ve dizi dünyasında en çok konuşulan yapımlar",
        exploreLink: "/filmler?sort=popular",
    },
    {
        key: "popular_movies",
        title: "Popüler Filmler",
        icon: "🎬",
        subtitle: "İzleyicilerin şu sıralar en çok tercih ettiği filmler",
        exploreLink: "/filmler?sort=popular",
        defaultMediaType: "movie",
    },
    {
        key: "popular_tv",
        title: "Popüler Diziler",
        icon: "📺",
        subtitle: "Gündemden düşmeyen sürükleyici diziler",
        exploreLink: "/tv?sort=popular",
        defaultMediaType: "tv",
    },
    {
        key: "top_rated_movies",
        title: "Tüm Zamanların En İyi Filmleri",
        icon: "🏆",
        subtitle: "Sinema tarihine adını altın harflerle yazdıran başyapıtlar",
        exploreLink: "/filmler?sort=rating",
        defaultMediaType: "movie",
    },
    {
        key: "top_rated_tv",
        title: "En Yüksek Puanlı Diziler",
        icon: "⭐",
        subtitle: "Eleştirmenlerden ve izleyicilerden tam not alan efsane diziler",
        exploreLink: "/tv?sort=rating",
        defaultMediaType: "tv",
    },
    {
        key: "now_playing",
        title: "Vizyondaki Filmler",
        icon: "🎟️",
        subtitle: "Sinemalarda gösterimde olan en taze yapımlar",
        exploreLink: "/filmler?sort=newest",
        defaultMediaType: "movie",
    },
    {
        key: "airing_today",
        title: "Bugün Yayınlanan Diziler",
        icon: "📡",
        subtitle: "Yeni bölümleriyle bugün ekranlara gelen diziler",
        exploreLink: "/tv?sort=newest",
        defaultMediaType: "tv",
    },
];

function CarouselRow({ section, rawItems }) {
    const rowRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const items = (rawItems || []).map((item) =>
        adaptCatalogCard({
            ...item,
            media_type: item.media_type || section.defaultMediaType || "movie",
        })
    );

    const updateScrollButtons = () => {
        const el = rowRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 12);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 12);
    };

    useEffect(() => {
        updateScrollButtons();
        window.addEventListener("resize", updateScrollButtons);
        return () => window.removeEventListener("resize", updateScrollButtons);
    }, [items.length]);

    const handleScroll = (direction) => {
        const el = rowRef.current;
        if (!el) return;
        const scrollAmount = Math.max(el.clientWidth * 0.78, 320);
        el.scrollBy({
            left: direction === "left" ? -scrollAmount : scrollAmount,
            behavior: "smooth",
        });
    };

    if (!items.length) return null;

    return (
        <section className="showcase-row-section">
            <div className="showcase-row-header">
                <div>
                    <h2 className="showcase-row-title">
                        <span className="showcase-row-icon">{section.icon}</span>
                        <span>{section.title}</span>
                        <span className="showcase-row-count">{items.length}</span>
                    </h2>
                    {section.subtitle && (
                        <p className="showcase-row-subtitle">{section.subtitle}</p>
                    )}
                </div>

                <div className="showcase-row-controls">
                    {section.exploreLink && (
                        <Link to={section.exploreLink} className="showcase-explore-link">
                            Tümünü Gör →
                        </Link>
                    )}
                    <div className="showcase-arrow-group">
                        <button
                            type="button"
                            onClick={() => handleScroll("left")}
                            disabled={!canScrollLeft}
                            className="showcase-scroll-btn"
                            aria-label={`${section.title} sola kaydır`}
                            title="Sola kaydır"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            onClick={() => handleScroll("right")}
                            disabled={!canScrollRight}
                            className="showcase-scroll-btn"
                            aria-label={`${section.title} sağa kaydır`}
                            title="Sağa kaydır"
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            <div className="showcase-carousel-wrapper">
                <div
                    ref={rowRef}
                    onScroll={updateScrollButtons}
                    className="showcase-carousel-track"
                >
                    {items.map((item) => (
                        <div
                            key={`${item.mediaType}-${item.id}`}
                            className="showcase-carousel-item"
                        >
                            <MovieCard item={item} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function HomePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: favoriteIds = [] } = useFavoriteIds();
    const { mutate: toggleFavorite } = useToggleFavorite();

    // URL'de arama veya filtre parametresi varsa (örn. /?query=Matrix),
    // mevcut arama akışının bozulmaması için BrowsePage'i göster
    const hasBrowseParams = Boolean(
        searchParams.get("query") ||
        searchParams.get("genre") ||
        searchParams.get("sort") ||
        searchParams.get("page")
    );

    const [activeSlide, setActiveSlide] = useState(0);
    const [isHeroHovered, setIsHeroHovered] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["catalog-home"],
        queryFn: getCatalogHome,
        staleTime: 1000 * 60 * 15, // 15 dakika önbellek
        enabled: !hasBrowseParams,
    });

    const heroItems = (data?.hero || []).map((item) => adaptCatalogCard(item));
    const rows = data?.rows || {};

    // Otomatik Hero slayt geçişi (7 saniyede bir, fare üzerindeyken duraklatılır)
    useEffect(() => {
        if (heroItems.length <= 1 || isHeroHovered || hasBrowseParams) return;
        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % heroItems.length);
        }, 7000);
        return () => clearInterval(timer);
    }, [heroItems.length, isHeroHovered, hasBrowseParams]);

    if (hasBrowseParams) {
        return <BrowsePage mediaType="movie" />;
    }

    const currentHero = heroItems[activeSlide] || heroItems[0];
    const isCurrentHeroFav = currentHero
        ? favoriteIds.includes(String(currentHero.id))
        : false;

    const handleHeroSearch = (q) => {
        if (!q || !q.trim()) return;
        navigate(`/filmler?query=${encodeURIComponent(q.trim())}`);
    };

    const handleHeroFavorite = () => {
        if (!currentHero) return;
        if (!user) {
            navigate("/login");
            return;
        }
        toggleFavorite({ item: currentHero, isFavorite: isCurrentHeroFav });
    };

    return (
        <div className="page-container animate-fade-in">
            {/* Üst Arama ve Hızlı Geçiş Barı */}
            <div className="showcase-topbar">
                <div className="showcase-search-wrap">
                    <SearchAutocomplete
                        placeholder="Film, dizi, yönetmen veya oyuncu ara..."
                        mediaType="all"
                        onSearch={handleHeroSearch}
                        variant="page"
                    />
                </div>
                <div className="showcase-quick-pills">
                    <Link to="/discover" className="showcase-pill showcase-pill-ai">
                        <span>✨</span>
                        <span>AI Film Danışmanı</span>
                    </Link>
                    <Link to="/filmler" className="showcase-pill">
                        <span>🎬</span>
                        <span>Tüm Filmler</span>
                    </Link>
                    <Link to="/tv" className="showcase-pill">
                        <span>📺</span>
                        <span>Tüm Diziler</span>
                    </Link>
                </div>
            </div>

            {error ? (
                <ErrorBox message={error.message} />
            ) : isLoading ? (
                <div>
                    <div
                        className="skeleton-card"
                        style={{
                            height: "460px",
                            borderRadius: "var(--radius-lg)",
                            marginBottom: "2.5rem",
                        }}
                    />
                    <Skeleton count={8} />
                </div>
            ) : (
                <>
                    {/* 5'li İnteraktif Hero Banner */}
                    {currentHero && (
                        <div
                            className="hero-banner showcase-hero-banner"
                            onMouseEnter={() => setIsHeroHovered(true)}
                            onMouseLeave={() => setIsHeroHovered(false)}
                        >
                            {currentHero.backdropUrl && (
                                <div
                                    key={currentHero.id}
                                    className="hero-backdrop showcase-hero-backdrop"
                                    style={{
                                        backgroundImage: `url(${currentHero.backdropUrl})`,
                                    }}
                                />
                            )}
                            <div className="hero-overlay showcase-hero-overlay" />

                            <div className="hero-content showcase-hero-content">
                                <div className="showcase-hero-badges">
                                    <span className="showcase-hero-rank-badge">
                                        🔥 Vitrin #{activeSlide + 1}
                                    </span>
                                    <span
                                        className={`autocomplete-badge ${currentHero.mediaType === "tv"
                                                ? "badge-tv"
                                                : "badge-movie"
                                            }`}
                                        style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                                    >
                                        {currentHero.mediaType === "tv" ? "📺 Dizi" : "🎬 Film"}
                                    </span>
                                    {currentHero.rating && currentHero.rating !== "N/A" && (
                                        <span className="rating-badge" style={{ fontSize: "0.9rem" }}>
                                            ★ {currentHero.rating}
                                        </span>
                                    )}
                                    {currentHero.year && (
                                        <span className="showcase-hero-year">
                                            {currentHero.year}
                                        </span>
                                    )}
                                </div>

                                <h1 className="hero-title showcase-hero-title">
                                    {currentHero.title}
                                </h1>

                                <p className="hero-overview">
                                    {currentHero.overview ||
                                        "Bu yapım için henüz Türkçe özet bulunmuyor. Detay sayfasından fragman, oyuncu kadrosu ve yayın platformlarını inceleyebilirsiniz."}
                                </p>

                                <div className="showcase-hero-actions">
                                    <Link
                                        to={
                                            currentHero.mediaType === "tv"
                                                ? `/dizi/${currentHero.id}`
                                                : `/film/${currentHero.id}`
                                        }
                                        state={{
                                            mediaType: currentHero.mediaType,
                                            title: currentHero.title,
                                        }}
                                        className="btn-primary showcase-hero-btn-primary"
                                    >
                                        <span>▶</span>
                                        <span>Detayları İncele</span>
                                    </Link>

                                    <button
                                        type="button"
                                        onClick={handleHeroFavorite}
                                        className="btn-secondary showcase-hero-btn-secondary"
                                    >
                                        <span>{isCurrentHeroFav ? "❤️" : "🤍"}</span>
                                        <span>
                                            {isCurrentHeroFav
                                                ? "Favorilerimde"
                                                : "Favorilere Ekle"}
                                        </span>
                                    </button>

                                    <Link
                                        to="/discover"
                                        className="btn-secondary showcase-hero-btn-ai"
                                    >
                                        <span>✨</span>
                                        <span>Benzerini AI'a Sor</span>
                                    </Link>
                                </div>
                            </div>

                            {/* Slayt Seçici Noktalar ve Önizleme Başlıkları */}
                            {heroItems.length > 1 && (
                                <div className="showcase-hero-nav">
                                    <button
                                        type="button"
                                        className="showcase-hero-step-btn"
                                        onClick={() =>
                                            setActiveSlide(
                                                (prev) =>
                                                    (prev - 1 + heroItems.length) %
                                                    heroItems.length
                                            )
                                        }
                                        aria-label="Önceki vitrin yapımı"
                                    >
                                        ‹
                                    </button>

                                    <div className="showcase-hero-dots">
                                        {heroItems.map((slide, idx) => (
                                            <button
                                                key={`${slide.mediaType}-${slide.id}`}
                                                type="button"
                                                onClick={() => setActiveSlide(idx)}
                                                className={`showcase-hero-dot ${idx === activeSlide ? "active" : ""
                                                    }`}
                                                title={slide.title}
                                            >
                                                <span className="showcase-hero-dot-title">
                                                    {slide.title}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        className="showcase-hero-step-btn"
                                        onClick={() =>
                                            setActiveSlide(
                                                (prev) => (prev + 1) % heroItems.length
                                            )
                                        }
                                        aria-label="Sonraki vitrin yapımı"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 7 Kategorili Yatay Kaydırılabilir Vitrin Karuselleri */}
                    <div className="showcase-rows-container">
                        {CAROUSEL_SECTIONS.map((section) => (
                            <CarouselRow
                                key={section.key}
                                section={section}
                                rawItems={rows[section.key]}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}