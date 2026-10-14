import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { ErrorBox } from "../components/ErrorBox";
import { FeedbackButtons } from "../components/FeedbackButtons";

export default function Profile() {
    const { user, login } = useAuth();
    const queryClient = useQueryClient();
    const [newUsername, setNewUsername] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    // Önerileri Çekme
    const { data: recs } = useQuery({
        queryKey: ["recommendations"],
        queryFn: () => apiFetch("/recommendations"),
    });

    // Sohbet Oturumlarını Çekme
    const { data: sessionsData } = useQuery({
        queryKey: ["sessions"],
        queryFn: () => apiFetch("/sessions"),
    });

    // Kullanıcı Adı Değiştirme
    const updateUsername = async (e) => {
        e.preventDefault();
        try {
            await apiFetch("/update-profile", {
                method: "POST",
                body: JSON.stringify({ new_username: newUsername }),
            });
            login(user.token, newUsername);
            setNewUsername("");
            alert("Kullanıcı adı başarıyla güncellendi.");
        } catch (err) {
            alert("Hata: " + err.message);
        }
    };

    // Şifre Değiştirme
    const updatePassword = async (e) => {
        e.preventDefault();
        try {
            await apiFetch("/change-password", {
                method: "POST",
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
            });
            setOldPassword("");
            setNewPassword("");
            alert("Şifreniz başarıyla değiştirildi.");
        } catch (err) {
            alert("Hata: " + err.message);
        }
    };

    // Oturum Silme
    const { mutate: deleteSession } = useMutation({
        mutationFn: (sessionId) => apiFetch(`/chat/${sessionId}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sessions"] })
        }
    });

    // Önerileri okundu işaretleme
    const markAsRead = async () => {
        try {
            await apiFetch("/recommendations/read", { method: "PATCH" });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">
                    <span>👤</span>
                    <span>Profil ve Hesap Ayarları</span>
                </h1>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "28px" }}>
                {/* Sol Panel: Güvenlik ve Ayarlar */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div className="glass-panel" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Kullanıcı Adı Değiştir</h3>
                        <form onSubmit={updateUsername} style={{ display: "flex", gap: "10px" }}>
                            <input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="Yeni kullanıcı adı"
                                required
                                style={{ flex: 1 }}
                            />
                            <button type="submit" className="btn-primary" style={{ padding: "10px 18px" }}>
                                Güncelle
                            </button>
                        </form>
                    </div>

                    <div className="glass-panel" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Şifre Değiştir</h3>
                        <form onSubmit={updatePassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Mevcut şifre"
                                required
                            />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Yeni şifre"
                                required
                            />
                            <button type="submit" className="btn-secondary" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
                                Şifreyi Güncelle
                            </button>
                        </form>
                    </div>
                </div>

            </div>








        </div >
    );
}