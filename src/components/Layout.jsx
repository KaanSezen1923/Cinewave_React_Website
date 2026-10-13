import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const isDiscover = location.pathname === "/discover";

    return (
        <div style={{ height: isDiscover ? "100vh" : "auto", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: isDiscover ? "hidden" : "visible" }}>
            <header className="navbar" style={{ flexShrink: 0 }}>
                <Link to="/discover" className="nav-brand">
                    <div className="nav-brand-icon">▶</div>
                    <span>CineWave</span>
                </Link>

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
            </header>

            <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingBottom: isDiscover ? 0 : "3rem", overflow: isDiscover ? "hidden" : "visible" }}>
                <Outlet />
            </main>

            {!isDiscover && (
                <footer style={{
                    padding: "2rem",
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