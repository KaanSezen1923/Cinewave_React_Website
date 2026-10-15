import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/api";
import { adaptCatalogCard } from "../utils/adapters";

const STORAGE_KEY = "cinewave_recent_searches";
const POPULAR_SEARCHES = [
    { title: "Matrix", type: "movie" },
    { title: "Interstellar", type: "movie" },
    { title: "Breaking Bad", type: "tv" },
    { title: "Stranger Things", type: "tv" },
    { title: "Inception", type: "movie" },
    { title: "The Dark Knight", type: "movie" },
];

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150" viewBox="0 0 100 150"><rect width="100" height="150" fill="%231a1e2e"/><text x="50%" y="50%" font-family="sans-serif" font-size="10" fill="%2364748b" text-anchor="middle" dominant-baseline="middle">Afiş Yok</text></svg>`;

export default function SearchAutocomplete({
    initialValue = "",
    placeholder = "Film veya dizi ara...",
    mediaType = "all", // "movie" | "tv" | "all"
    onSearch,
    variant = "page", // "page" | "navbar"
    autoFocus = false,
}) {
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState(initialValue);
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [activeTab, setActiveTab] = useState(mediaType === "tv" ? "tv" : mediaType === "movie" ? "movie" : "all");
    const [recentSearches, setRecentSearches] = useState([]);

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const dropdownListRef = useRef(null);

    // Dışarıdan initialValue değişirse güncelle
    useEffect(() => {
        setInputValue(initialValue || "");
    }, [initialValue]);

    // Son aramaları localStorage'dan oku
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setRecentSearches(JSON.parse(saved).slice(0, 6));
            }
        } catch {
            setRecentSearches([]);
        }
    }, []);

    // Son aramaları kaydet
    const saveRecentSearch = useCallback((term) => {
        if (!term || !term.trim()) return;
        const clean = term.trim();
        setRecentSearches((prev) => {
            const filtered = prev.filter((s) => s.toLowerCase() !== clean.toLowerCase());
            const next = [clean, ...filtered].slice(0, 6);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch { }
            return next;
        });
    }, []);

    // Belirli bir son aramayı sil
    const removeRecentSearch = (e, termToRemove) => {
        e.stopPropagation();
        setRecentSearches((prev) => {
            const next = prev.filter((s) => s !== termToRemove);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch { }
            return next;
        });
    };

    // Tüm son aramaları temizle
    const clearAllRecent = (e) => {
        e.stopPropagation();
        setRecentSearches([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { }
    };

    // Otomatik tamamlama verisi çekme (Debounced)
    const fetchSuggestions = useCallback(async (query) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await apiFetch(`/catalog/search?q=${encodeURIComponent(trimmed)}`);
            const rawList = data?.results || [];
            const adapted = rawList.map((item) => adaptCatalogCard(item));
            setResults(adapted);
            setSelectedIndex(-1);
        } catch (err) {
            console.error("Autocomplete arama hatası:", err);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Input değişimi
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);
        setSelectedIndex(-1);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (val.trim().length >= 2) {
            setIsLoading(true);
            debounceTimerRef.current = setTimeout(() => {
                fetchSuggestions(val);
            }, 260);
        } else {
            setResults([]);
            setIsLoading(false);
        }
    };

    // Filtrelenmiş sonuçlar (Tümü, Filmler, Diziler sekmesine göre)
    const filteredResults = results.filter((item) => {
        if (activeTab === "movie") return item.mediaType === "movie";
        if (activeTab === "tv") return item.mediaType === "tv";
        return true;
    });

    // Arama gönderildiğinde (Enter veya Bul tıklandığında)
    const triggerSearch = (queryToSearch) => {
        const finalQuery = (queryToSearch !== undefined ? queryToSearch : inputValue).trim();
        if (!finalQuery) return;

        saveRecentSearch(finalQuery);
        setIsOpen(false);
        if (inputRef.current) inputRef.current.blur();

        if (onSearch) {
            onSearch(finalQuery);
        } else {
            // Navbar veya bağımsız kullanım: BrowsePage'e yönlendir
            const target = activeTab === "tv" ? `/tv?query=${encodeURIComponent(finalQuery)}` : `/?query=${encodeURIComponent(finalQuery)}`;
            navigate(target);
        }
    };

    // Bir öneriye tıklandığında doğrudan detay sayfasına git
    const handleSelectItem = (item) => {
        saveRecentSearch(item.title);
        setIsOpen(false);
        const path = item.mediaType === "tv" ? `/dizi/${item.id}` : `/film/${item.id}`;
        navigate(path, {
            state: { mediaType: item.mediaType, title: item.title }
        });
    };

    // Klavye kısayolları ile gezinme
    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setIsOpen(true);
            }
            return;
        }

        const maxIndex = filteredResults.length - 1;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => {
                const next = prev < maxIndex ? prev + 1 : 0;
                scrollItemIntoView(next);
                return next;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => {
                const next = prev > 0 ? prev - 1 : maxIndex;
                scrollItemIntoView(next);
                return next;
            });
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (selectedIndex >= 0 && filteredResults[selectedIndex]) {
                handleSelectItem(filteredResults[selectedIndex]);
            } else {
                triggerSearch(inputValue);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    const scrollItemIntoView = (index) => {
        if (!dropdownListRef.current) return;
        const items = dropdownListRef.current.querySelectorAll(".autocomplete-item");
        if (items[index]) {
            items[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    };

    // Dışarı tıklama kontrolü
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    // Arama metnini temizle
    const handleClear = () => {
        setInputValue("");
        setResults([]);
        setSelectedIndex(-1);
        if (inputRef.current) inputRef.current.focus();
        if (onSearch && initialValue) {
            onSearch("");
        }
    };

    // Eşleşen kelimeyi vurgulama
    const renderHighlightedTitle = (title, query) => {
        if (!query || !title) return title;
        const cleanQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!cleanQuery) return title;
        const regex = new RegExp(`(${cleanQuery})`, "gi");
        const parts = title.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? (
                <mark key={i} className="autocomplete-highlight">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    const hasQuery = inputValue.trim().length >= 2;
    const showRecent = !hasQuery && isOpen;

    return (
        <div
            ref={containerRef}
            className={`search-autocomplete-container ${variant === "navbar" ? "navbar-variant" : "page-variant"}`}
            onKeyDown={handleKeyDown}
        >
            <div className="search-autocomplete-input-wrap">
                <span className="search-icon-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </span>

                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="search-autocomplete-input"
                    autoComplete="off"
                    spellCheck="false"
                />

                {/* Yükleniyor Spinner */}
                {isLoading && (
                    <div className="search-spinner" title="Aranıyor...">
                        <span className="spinner-dot"></span>
                    </div>
                )}

                {/* Temizle Butonu */}
                {inputValue && !isLoading && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="search-clear-btn"
                        title="Temizle"
                        aria-label="Aramayı Temizle"
                    >
                        ✕
                    </button>
                )}

                {/* Bul Butonu */}
                <button
                    type="button"
                    onClick={() => triggerSearch(inputValue)}
                    className="search-autocomplete-submit-btn"
                    title="Ara"
                >
                    <span>Bul</span>
                </button>
            </div>

            {/* Otomatik Tamamlama Dropdown Paneli */}
            {isOpen && (
                <div className="search-autocomplete-dropdown animate-dropdown-fade">
                    {/* Sekmeler: Sonuç varken Tümü / Filmler / Diziler filtresi */}
                    {hasQuery && results.length > 0 && (
                        <div className="autocomplete-tabs">
                            <button
                                type="button"
                                className={`autocomplete-tab ${activeTab === "all" ? "active" : ""}`}
                                onClick={() => setActiveTab("all")}
                            >
                                Tümü ({results.length})
                            </button>
                            <button
                                type="button"
                                className={`autocomplete-tab ${activeTab === "movie" ? "active" : ""}`}
                                onClick={() => setActiveTab("movie")}
                            >
                                🎬 Filmler ({results.filter((x) => x.mediaType === "movie").length})
                            </button>
                            <button
                                type="button"
                                className={`autocomplete-tab ${activeTab === "tv" ? "active" : ""}`}
                                onClick={() => setActiveTab("tv")}
                            >
                                📺 Diziler ({results.filter((x) => x.mediaType === "tv").length})
                            </button>
                        </div>
                    )}

                    {/* Sonuç Listesi */}
                    {hasQuery && (
                        <div ref={dropdownListRef} className="autocomplete-results-list">
                            {isLoading && results.length === 0 ? (
                                <div className="autocomplete-loading-state">
                                    <div className="autocomplete-mini-spinner" />
                                    <span>Film ve diziler aranıyor...</span>
                                </div>
                            ) : filteredResults.length > 0 ? (
                                <>
                                    {filteredResults.slice(0, 8).map((item, idx) => (
                                        <div
                                            key={`${item.mediaType}-${item.id}`}
                                            className={`autocomplete-item ${idx === selectedIndex ? "selected" : ""}`}
                                            onClick={() => handleSelectItem(item)}
                                            onMouseEnter={() => setSelectedIndex(idx)}
                                        >
                                            <div className="autocomplete-poster-wrap">
                                                <img
                                                    src={item.posterUrl || FALLBACK_POSTER}
                                                    alt={item.title}
                                                    className="autocomplete-poster"
                                                    onError={(e) => {
                                                        e.target.src = FALLBACK_POSTER;
                                                    }}
                                                    loading="lazy"
                                                />
                                            </div>

                                            <div className="autocomplete-info">
                                                <div className="autocomplete-title-row">
                                                    <span className="autocomplete-title">
                                                        {renderHighlightedTitle(item.title, inputValue)}
                                                    </span>
                                                    <span className={`autocomplete-badge ${item.mediaType === "tv" ? "badge-tv" : "badge-movie"}`}>
                                                        {item.mediaType === "tv" ? "📺 Dizi" : "🎬 Film"}
                                                    </span>
                                                </div>

                                                <div className="autocomplete-meta">
                                                    {item.year && <span className="autocomplete-year">{item.year}</span>}
                                                    {item.rating && item.rating !== "N/A" && (
                                                        <span className="autocomplete-rating">
                                                            ★ {item.rating}
                                                        </span>
                                                    )}
                                                </div>

                                                {item.overview && (
                                                    <p className="autocomplete-overview">
                                                        {item.overview}
                                                    </p>
                                                )}
                                            </div>

                                            <span className="autocomplete-arrow">→</span>
                                        </div>
                                    ))}

                                    {/* Tüm Sonuçları Gör Butonu */}
                                    <div
                                        className="autocomplete-footer-action"
                                        onClick={() => triggerSearch(inputValue)}
                                    >
                                        <span>
                                            <strong>"{inputValue}"</strong> için tüm sonuçları gör
                                        </span>
                                        <span className="footer-action-badge">{filteredResults.length} sonuç</span>
                                    </div>
                                </>
                            ) : (
                                !isLoading && (
                                    <div className="autocomplete-empty-state">
                                        <div className="empty-state-icon">🔍</div>
                                        <div className="empty-state-text">
                                            <strong>"{inputValue}"</strong> ile eşleşen film veya dizi bulunamadı.
                                        </div>
                                        <button
                                            type="button"
                                            className="empty-state-action"
                                            onClick={() => triggerSearch(inputValue)}
                                        >
                                            Yine de katalogda ara
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* Arama Yapılmamışken: Son Aramalar & Popüler Öneriler */}
                    {showRecent && (
                        <div className="autocomplete-preset-panel">
                            {recentSearches.length > 0 && (
                                <div className="recent-searches-section">
                                    <div className="preset-section-header">
                                        <span className="section-title">
                                            <span style={{ marginRight: 6 }}>🕒</span> Son Aramalar
                                        </span>
                                        <button
                                            type="button"
                                            className="clear-recent-btn"
                                            onClick={clearAllRecent}
                                        >
                                            Temizle
                                        </button>
                                    </div>
                                    <div className="recent-tags-list">
                                        {recentSearches.map((term, i) => (
                                            <div
                                                key={i}
                                                className="recent-tag"
                                                onClick={() => {
                                                    setInputValue(term);
                                                    triggerSearch(term);
                                                }}
                                            >
                                                <span className="tag-text">{term}</span>
                                                <button
                                                    type="button"
                                                    className="tag-remove"
                                                    onClick={(e) => removeRecentSearch(e, term)}
                                                    title="Kaldır"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Popüler Aramalar */}
                            <div className="popular-searches-section">
                                <div className="preset-section-header">
                                    <span className="section-title">
                                        <span style={{ marginRight: 6 }}>🔥</span> Popüler Başlıklar
                                    </span>
                                </div>
                                <div className="popular-tags-list">
                                    {POPULAR_SEARCHES.map((item, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            className="popular-tag"
                                            onClick={() => {
                                                setInputValue(item.title);
                                                fetchSuggestions(item.title);
                                                setIsOpen(true);
                                            }}
                                        >
                                            <span>{item.type === "movie" ? "🎬" : "📺"}</span>
                                            <span>{item.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
