import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/api";
import { ErrorBox } from "../components/ErrorBox";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await apiFetch("/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            login(data.access_token, data.username);
            navigate("/");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <div className="auth-box">
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🔐</div>
                    <h2 style={{ fontSize: "1.8rem" }}>Giriş Yap</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "6px" }}>
                        Favorilerini kaydetmek ve AI asistanını kullanmak için hesabına giriş yap.
                    </p>
                </div>

                {error && <ErrorBox message={error} />}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                            Kullanıcı Adı
                        </label>
                        <input
                            placeholder="Kullanıcı adınızı girin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{ width: "100%" }}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                            Şifre
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ width: "100%" }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{ width: "100%", padding: "12px", marginTop: "8px", fontSize: "1rem" }}
                    >
                        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                    </button>
                </form>

                <p style={{ textAlign: "center", marginTop: "1.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Hesabın yok mu?{" "}
                    <Link to="/signup" style={{ color: "var(--accent-red)", fontWeight: 600 }}>
                        Kayıt Ol
                    </Link>
                </p>
            </div>
        </div>
    );
}