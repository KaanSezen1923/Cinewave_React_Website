import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const isDiscover = location.pathname === "/discover";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Sayfa değiştiğinde mobil menüyü otomatik kapat
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Mobil menü açıkken body kaydırmasını engelle
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileMenuOpen]);

    return (
        <div style={{
            height: isDiscover ? "100dvh" : "auto",
            minHeight: isDiscover ? "100dvh" : "100vh",
            display: "flex",
            flexDirection: "column",
            overflow: isDiscover ? "hidden" : "visible"
        }}>
            <header className="navbar" style={{ flexShrink: 0 }}>
                <Link to="/discover" className="nav-brand">
                    <div className="nav-brand-icon">▶</div>
                    <span>CineWave</span>
                </Link>

                {/* Masaüstü Navigasyon Linkleri */}
                <nav className="nav-links">
                    <NavLink
                        to="/discover"
                        className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                    >
                        Keşfet
                    </NavLink>
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                    >
                        Filmler
                    </NavLink>
                    <NavLink
                        to="/tv"
                        className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                    >
                        Diziler
                    </NavLink>
                    {user && (
                        <NavLink
                            to="/favorites"
                            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                        >
                            Favorilerim
                        </NavLink>
                    )}
                    {user && (
                        <NavLink
                            to="/profile"
                            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                        >
                            Profil
                        </NavLink>
                    )}
                </nav>

                {/* Masaüstü Kullanıcı Durumu */}
                <div className="nav-user">
                    {user ? (
                        <>
                            <div className="user-badge">
                                <div className="user-avatar">
                                    {(user.username || "K").charAt(0).toUpperCase()}
                                </div>
                                <span>{user.username}</span>
                            </div>
                            <button onClick={logout} className="btn-logout">
                                Çıkış Yap
                            </button>
                        </>
                    ) : (
                        <div style={{ display: "flex", gap: "10px" }}>
                            <Link to="/login" className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>
                                Giriş Yap
                            </Link>
                            <Link to="/signup" className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>
                                Kayıt Ol
                            </Link>
                        </div>
                    )}
                </div>

                {/* Mobil Sağ Kontroller (Kullanıcı Avatarı + Hamburger) */}
                <div className="nav-mobile-controls">
                    {user && (
                        <div className="mobile-user-indicator" title={user.username}>
                            {(user.username || "K").charAt(0).toUpperCase()}
                        </div>
                    )}
                    <button
                        type="button"
                        className={`mobile-menu-toggle ${mobileMenuOpen ? "open" : ""}`}
                        onClick={() => setMobileMenuOpen(prev => !prev)}
                        aria-label={mobileMenuOpen ? "Menüyü Kapat" : "Menüyü Aç"}
                    >
                        <span className="hamburger-bar"></span>
                        <span className="hamburger-bar"></span>
                        <span className="hamburger-bar"></span>
                    </button>
                </div>
            </header>

            {/* Mobil Menü Çekmecesi & Karartma */}
            <div
                className={`mobile-nav-backdrop ${mobileMenuOpen ? "open" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
            />
            <div className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}>
                <div className="mobile-nav-drawer-header">
                    <div className="nav-brand">
                        <div className="nav-brand-icon">▶</div>
                        <span>CineWave</span>
                    </div>
                    <button
                        type="button"
                        className="mobile-drawer-close"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Kapat"
                    >
                        ✕
                    </button>
                </div>

                {/* Kullanıcı Bilgisi (Giriş yapılmışsa) */}
                {user && (
                    <div className="mobile-drawer-user-card">
                        <div className="user-avatar" style={{ width: "36px", height: "36px", fontSize: "16px" }}>
                            {(user.username || "K").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{user.username}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Aktif Kullanıcı</div>
                        </div>
                    </div>
                )}

                <div className="mobile-drawer-links">
                    <NavLink
                        to="/discover"
                        className={({ isActive }) => `mobile-drawer-link ${isActive ? "active" : ""}`}
                    >
                        <span className="link-icon">✨</span>
                        <span>AI Keşfet</span>
                    </NavLink>
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => `mobile-drawer-link ${isActive ? "active" : ""}`}
                    >
                        <span className="link-icon">🎬</span>
                        <span>Filmler</span>
                    </NavLink>
                    <NavLink
                        to="/tv"
                        className={({ isActive }) => `mobile-drawer-link ${isActive ? "active" : ""}`}
                    >
                        <span className="link-icon">📺</span>
                        <span>Diziler</span>
                    </NavLink>
                    {user && (
                        <NavLink
                            to="/favorites"
                            className={({ isActive }) => `mobile-drawer-link ${isActive ? "active" : ""}`}
                        >
                            <span className="link-icon">❤️</span>
                            <span>Favorilerim</span>
                        </NavLink>
                    )}
                    {user && (
                        <NavLink
                            to="/profile"
                            className={({ isActive }) => `mobile-drawer-link ${isActive ? "active" : ""}`}
                        >
                            <span className="link-icon">👤</span>
                            <span>Profil ve Ayarlar</span>
                        </NavLink>
                    )}
                </div>

                <div className="mobile-drawer-footer">
                    {user ? (
                        <button
                            onClick={() => {
                                logout();
                                setMobileMenuOpen(false);
                            }}
                            className="btn-logout"
                            style={{ width: "100%", padding: "12px", textAlign: "center", fontSize: "0.95rem" }}
                        >
                            Çıkış Yap
                        </button>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <Link
                                to="/login"
                                className="btn-secondary"
                                style={{ width: "100%", justifyContent: "center", padding: "12px" }}
                            >
                                Giriş Yap
                            </Link>
                            <Link
                                to="/signup"
                                className="btn-primary"
                                style={{ width: "100%", justifyContent: "center", padding: "12px" }}
                            >
                                Kayıt Ol
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <main style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                paddingBottom: isDiscover ? 0 : "3rem",
                overflow: isDiscover ? "hidden" : "visible"
            }}>
                <Outlet />
            </main>

            {!isDiscover && (
                <footer style={{
                    padding: "2rem 1rem",
                    textAlign: "center",
                    borderTop: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    fontSize: "0.85rem",
                    marginTop: "auto"
                }}>
                    <p>© 2026 CineWave. TMDB API ve Yapay Zeka ile Güçlendirilmiştir.</p>
                </footer>
            )}
        </div>
    );
}