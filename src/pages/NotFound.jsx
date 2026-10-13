import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <div className="page-container animate-fade-in" style={{ textAlign: "center", padding: "100px 20px" }}>
            <h1 style={{ fontSize: "6rem", fontWeight: 900, color: "var(--accent-red)", marginBottom: "10px" }}>404</h1>
            <h2 style={{ fontSize: "1.8rem", marginBottom: "16px" }}>Sayfa Bulunamadı</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "30px", maxWidth: "450px", margin: "0 auto 30px" }}>
                Aradığınız film, dizi veya sayfa kaldırılmış ya da adresi değişmiş olabilir.
            </p>
            <Link to="/discover" className="btn-primary" style={{ padding: "12px 28px" }}>
                Keşfet'e Dön
            </Link>
        </div>
    );
}