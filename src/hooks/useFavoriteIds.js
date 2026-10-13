import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { useAuth } from "../context/AuthContext";

export function useFavoriteIds() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["favoriteIds"],
        queryFn: async () => {
            const data = await apiFetch("/favorites/ids");
            return data.favorite_ids || [];
        },
        enabled: !!user, // Sadece giriş yapmış kullanıcılar için çalıştır
        staleTime: 1000 * 60 * 5, // 5 dakika cache
    });
}