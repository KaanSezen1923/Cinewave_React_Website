import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { ErrorBox } from "../components/ErrorBox";

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
            queryClient.invalidateQueries({ queryKey: ["sessions"] });
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

                {/* Sağ Panel: Sana Özel Öneriler ve Geçmiş */}
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div className="glass-panel" style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h3 style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>🔔</span> Sana Özel Bildirimler
                            </h3>
                            {recs?.some(r => !r.is_read) && (
                                <button onClick={markAsRead} className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
                                    Tümünü Okundu Say
                                </button>
                            )}
                        </div>
                        <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                            {recs?.length > 0 ? recs.map(r => (
                                <div
                                    key={r.id}
                                    style={{
                                        padding: "12px",
                                        background: r.is_read ? "rgba(255,255,255,0.02)" : "rgba(229,9,20,0.1)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "var(--radius-sm)"
                                    }}
                                >
                                    <p style={{ fontWeight: r.is_read ? 500 : 700, marginBottom: "4px" }}>{r.title}</p>
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{r.body}</p>
                                </div>
                            )) : (
                                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Henüz yeni bir öneri bildirimi yok.</p>
                            )}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: "24px" }}>
                        <h3 style={{ fontSize: "1.2rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>💬</span> AI Sohbet Geçmişi
                        </h3>
                        <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                            {sessionsData?.sessions?.length > 0 ? sessionsData.sessions.map(s => (
                                <div
                                    key={s.session_id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "10px 14px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "var(--radius-sm)"
                                    }}
                                >
                                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {s.title}
                                    </span>
                                    <button
                                        onClick={() => deleteSession(s.session_id)}
                                        style={{ background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontSize: "0.85rem" }}
                                    >
                                        Sil
                                    </button>
                                </div>
                            )) : (
                                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Kayıtlı sohbet geçmişi bulunmuyor.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}