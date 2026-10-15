// Platform "deep search" linkleri.
// Bir platform için ya doğrudan arama URL'i (`search`), ya da arama URL'i
// bilinmiyorsa/güvenilir değilse Google `site:` araması (`site`) tanımlanır.

const enc = encodeURIComponent;

// Sıra önemlidir: spesifik kurallar genel olanlardan önce gelmeli.
// `ids` TMDB provider_id değerleridir (isim değişse bile eşleşir), `name` yedek eşleşmedir.
const RULES = [
    { key: "netflix", ids: [8, 1796], name: /netflix/, search: (q) => `https://www.netflix.com/search?q=${q}` },
    { key: "prime", ids: [119, 10], name: /amazon|prime\s*video/, search: (q) => `https://www.primevideo.com/search/?phrase=${q}` },
    { key: "apple", ids: [2, 350], name: /apple\s*tv/, search: (q) => `https://tv.apple.com/search?term=${q}` },
    { key: "googleplay", ids: [3], name: /google\s*play/, search: (q) => `https://play.google.com/store/search?q=${q}&c=movies` },
    { key: "youtube", ids: [192], name: /youtube/, search: (q) => `https://www.youtube.com/results?search_query=${q}` },
    { key: "mubi", ids: [11], name: /mubi/, search: (q) => `https://mubi.com/tr/search/films?query=${q}` },
    { key: "disney", ids: [337], name: /disney/, site: "disneyplus.com" },
    { key: "hbo", ids: [1899], name: /\bhbo\b|\bmax\b|blu\s?tv/, site: "hbomax.com" }, // BluTV → HBO Max
    { key: "tod", name: /\btod\b|bein/, site: "todtv.com.tr" },
    { key: "gain", name: /\bgain\b/, site: "gain.tv" },
    { key: "exxen", name: /exxen/, site: "exxen.com" },
    { key: "tabii", name: /tabii|\btrt\b/, site: "tabii.com" },
    { key: "paramount", ids: [531], name: /paramount/, site: "paramountplus.com" },
];

// "İ" gibi Türkçe karakterlerde toLowerCase() bozuk çıktı verebildiği için normalize ediyoruz.
const norm = (s) =>
    (s || "")
        .toLocaleLowerCase("en-US")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

const findRule = ({ id, name }) => {
    const n = norm(name);
    return (
        RULES.find((r) => id != null && r.ids?.includes(Number(id))) ||
        RULES.find((r) => r.name.test(n))
    );
};

// Backend'den gelen doğrudan linkleri {platformKey: url} haritasına çevirir.
// Seçenekler backend'de zaten "subscription > free > addon > rent > buy" sırasında gelir;
// aynı platform için ilk (en iyi) link tutulur.
export function indexDirectLinks(options = []) {
    const map = {};
    for (const o of options) {
        const key = findRule({ name: o.name })?.key;
        if (key && !map[key] && typeof o.link === "string" && o.link.startsWith("https://")) {
            map[key] = o.link;
        }
    }
    return map;
}

/**
 * @param {{id?: number, name: string}} provider
 * @param {{title: string, originalTitle?: string, year?: string, mediaType?: "movie"|"tv", justWatchLink?: string, directLinks?: Record<string,string>}} ctx
 */
export function buildProviderUrl(provider, ctx) {
    const { title = "", year = "", mediaType = "movie", justWatchLink, directLinks } = ctx;
    const rule = findRule(provider);
    const kind = mediaType === "tv" ? "dizi" : "film";

    // 1) Doğrudan başlık sayfası (backend /watch-links)
    if (rule?.key && directLinks?.[rule.key]) return directLinks[rule.key];

    // 2) Platform içi arama
    if (rule?.search) {
        // YouTube'da "izle" eki sonuçları tam içeriklere yaklaştırır
        const text = /youtube/.test(rule.name.source) ? `${title} ${kind} izle` : title;
        return rule.search(enc(text));
    }

    // 3) Google site: araması
    if (rule?.site) {
        // Yıl eklemek aynı isimli yapımları ayırt etmeye yardım eder; tırnak tam eşleşme sağlar.
        const q = `site:${rule.site} "${title}" ${year}`.trim();
        return `https://www.google.com/search?q=${enc(q)}`;
    }

    // Tanınmayan platform: JustWatch sayfası en güvenilir seçenek
    return (
        justWatchLink ||
        `https://www.google.com/search?q=${enc(`${title} ${year} ${provider.name} ${kind} izle`.replace(/\s+/g, " ").trim())}`
    );
}

// Aynı platform birden fazla kez gelirse (ör. Netflix + Netflix basic with Ads) tekilleştir.
export function dedupeProviders(list = []) {
    const seen = new Set();
    return list.filter((p) => {
        const key = p.provider_id ?? p.id ?? norm(p.name || p.provider_name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}