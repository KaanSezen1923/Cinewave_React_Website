const formatRating = (val) => {
    if (val === undefined || val === null || val === "" || val === "undefined" || val === "null") {
        return "N/A";
    }
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
        return num.toFixed(1);
    }
    return String(val) || "N/A";
};

const extractPoster = (item) => {
    if (!item) return null;
    if (item.poster) return item.poster;
    if (item.poster_url) return item.poster_url;
    if (item.Poster) return item.Poster;
    if (item.poster_path) {
        return item.poster_path.startsWith("http")
            ? item.poster_path
            : `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    }
    return null;
};

const extractYear = (item) => {
    if (!item) return "";
    const raw = item.year || item.release_date || item.first_air_date || item.Yıl || "";
    return String(raw).substring(0, 4);
};

export const adaptCatalogCard = (item) => {
    if (!item) return {};
    return {
        id: String(item.id || item.movie_id),
        title: item.title || item.name || item.Film || "İsimsiz",
        posterUrl: extractPoster(item),
        backdropUrl: item.backdrop || (item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null),
        year: extractYear(item),
        rating: formatRating(item.rating ?? item.vote_average ?? item["TMDB Puanı"] ?? item.imdb_rating),
        mediaType: item.media_type || item.mediaType || (item.name ? "tv" : "movie"),
        overview: item.overview || "",
    };
};

export const adaptChatCard = (item) => {
    if (!item) return {};
    return {
        id: String(item.movie_id || item.id),
        title: item.Film || item.title || item.name || "İsimsiz",
        posterUrl: extractPoster(item),
        year: extractYear(item),
        rating: formatRating(item["TMDB Puanı"] ?? item.imdb_rating ?? item.rating ?? item.vote_average),
        mediaType: item.media_type || item.mediaType || "movie",
    };
};

export const adaptFavoriteCard = (item) => {
    if (!item) return {};
    return {
        id: String(item.movie_id || item.id),
        title: item.Film || item.title || item.name || "İsimsiz",
        posterUrl: extractPoster(item),
        rating: formatRating(item["TMDB Puanı"] ?? item.imdb_rating ?? item.rating ?? item.vote_average),
        year: extractYear(item),
        mediaType: item.media_type || item.mediaType || "movie",
    };
};