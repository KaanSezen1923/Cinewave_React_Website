const API_URL = import.meta.env.VITE_API_URL || "https://movierag-api.onrender.com";

export const apiFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            // 401 hatasında otomatik çıkış yapılması için event fırlatıyoruz
            window.dispatchEvent(new Event("unauthorized"));
        }
        const errorData = await response.json().catch(() => ({}));
        const detailMsg = typeof errorData.detail === "string"
            ? errorData.detail
            : (Array.isArray(errorData.detail)
                ? errorData.detail.map(d => d.msg || JSON.stringify(d)).join(", ")
                : (typeof errorData.detail === "object" && errorData.detail !== null
                    ? JSON.stringify(errorData.detail)
                    : "API isteğinde bir hata oluştu"));
        throw new Error(detailMsg);
    }

    return response.json();
};



export const getRecommendations = () => {
    return apiFetch('/recommendations');
};

export const markRecommendationsAsRead = () => {
    return apiFetch('/recommendations/read', { method: 'PATCH' });
};

export const getFeedbackIds = () => {
    return apiFetch('/feedback/ids');
};

export const getFeedbackStats = () => {
    return apiFetch('/feedback/stats');
};

export const sendFeedback = ({ movieId, title, feedback, source = "chat", sessionId = null }) => {
    return apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({
            movie_id: String(movieId),
            title,
            feedback,
            source,
            session_id: sessionId,
        }),
    });
};