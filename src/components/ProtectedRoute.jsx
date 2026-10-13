import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
    const { user } = useAuth();

    // Kullanıcı yoksa login'e yönlendir, varsa sayfayı (Outlet) göster
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}