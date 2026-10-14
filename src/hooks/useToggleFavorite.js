import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { useAuth } from "../context/AuthContext";

export function useToggleFavorite() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ item, isFavorite }) => {
            if (!user) throw new Error("Giriş yapmalısınız.");

            const mediaType = item.mediaType || (item.name ? "tv" : "movie");
            const itemId = String(item.id);

            try {
                const types = JSON.parse(localStorage.getItem("cinewave_media_types") || "{}");
                if (isFavorite) {
                    delete types[itemId];
                } else {
                    types[itemId] = mediaType;
                }
                localStorage.setItem("cinewave_media_types", JSON.stringify(types));
            } catch (e) {
                console.error("Local media type error:", e);
            }

            if (isFavorite) {
                return apiFetch(`/favorites/${encodeURIComponent(item.id)}`, { method: "DELETE" });
            } else {
                return apiFetch("/favorites", {
                    method: "POST",
                    body: JSON.stringify({
                        movie_id: itemId,
                        title: item.title || item.name,
                        poster_url: item.posterUrl,
                        imdb_rating: String(item.rating),
                        media_type: mediaType,
                    }),
                });
            }
        },
        // İyimser Güncelleme (Optimistic Update)
        onMutate: async ({ item, isFavorite }) => {
            await queryClient.cancelQueries({ queryKey: ["favoriteIds"] });
            const previousIds = queryClient.getQueryData(["favoriteIds"]);

            queryClient.setQueryData(["favoriteIds"], (old = []) => {
                if (isFavorite) return old.filter((id) => id !== String(item.id));
                return [...old, String(item.id)];
            });

            return { previousIds }; // Hata olursa geri dönmek için sakla
        },
        onError: (err, variables, context) => {
            // Hata durumunda eski veriyi geri yükle
            queryClient.setQueryData(["favoriteIds"], context.previousIds);
            alert("Favori işlemi başarısız: " + err.message);
        },
        onSettled: () => {
            // İşlem bitince her halükarda favori listelerini senkronize et
            queryClient.invalidateQueries({ queryKey: ["favoriteIds"] });
            queryClient.invalidateQueries({ queryKey: ["favorites"] });
        },
    });
}