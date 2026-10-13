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
        throw new Error(errorData.detail || "API isteğinde bir hata oluştu");
    }

    return response.json();
};



export const getRecommendations = () => {
    return apiFetch('/recommendations');
};

export const markRecommendationsAsRead = () => {
    return apiFetch('/recommendations/read', { method: 'PATCH' });
};