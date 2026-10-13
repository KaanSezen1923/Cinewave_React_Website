import { createContext, useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem("token");
        const username = localStorage.getItem("username");
        return token ? { token, username } : null;
    });

    const login = (token, username) => {
        localStorage.setItem("token", token);
        localStorage.setItem("username", username);
        setUser({ token, username });
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setUser(null);
        navigate("/login");
    };

    useEffect(() => {
        // api.js'den gelen 401 eventini dinle ve çıkış yap
        const handleUnauthorized = () => logout();
        window.addEventListener("unauthorized", handleUnauthorized);
        return () => window.removeEventListener("unauthorized", handleUnauthorized);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);