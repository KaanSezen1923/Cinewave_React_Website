import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { useAuth } from "../context/AuthContext";

export function useToggleFavorite() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ item, isFavorite }) => {
            if (!user) throw new Error("Giriş yapmalısınız.");

            if (isFavorite) {
                return apiFetch(`/favorites/${encodeURIComponent(item.id)}`, { method: "DELETE" });
            } else {
                return apiFetch("/favorites", {
                    method: "POST",
                    body: JSON.stringify({
                        movie_id: String(item.id),
                        title: item.title,
                        poster_url: item.posterUrl,
                        imdb_rating: String(item.rating),
                        media_type: item.mediaType || "movie"
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