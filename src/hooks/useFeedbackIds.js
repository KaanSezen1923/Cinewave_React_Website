import { useQuery } from "@tanstack/react-query";
import { getFeedbackIds } from "../api/api";
import { useAuth } from "../context/AuthContext";

export function useFeedbackIds() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["feedbackIds"],
        queryFn: async () => {
            const data = await getFeedbackIds();
            return {
                liked: (data?.liked || []).map(String),
                disliked: (data?.disliked || []).map(String),
            };
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
    });
}
