import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import DetailPage from "./pages/DetailPage";
import Discover from "./pages/Discover";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Recommendations from "./pages/Recommendations";
import ActorPage from "./pages/ActorPage";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          {/* Vitrin (Ana Sayfa Karuselleri) ve Katalog Rotaları */}
          <Route path="/" element={<HomePage />} />
          <Route path="/vitrin" element={<HomePage />} />
          <Route path="/filmler" element={<BrowsePage mediaType="movie" key="movie" />} />
          <Route path="/tv" element={<BrowsePage mediaType="tv" key="tv" />} />

          {/* İçerik Detay Rotaları */}
          <Route path="/film/:id" element={<DetailPage mediaType="movie" key="movie-detail" />} />
          <Route path="/dizi/:id" element={<DetailPage mediaType="tv" key="tv-detail" />} />

          {/* Oyuncu Detay ve Filmografi Rotası */}
          <Route path="/oyuncu/:id" element={<ActorPage />} />

          {/* Keşfet ve Kimlik Doğrulama Rotaları */}
          <Route path="/discover" element={<Discover />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Korumalı (Sadece Giriş Yapmış Kullanıcılar İçin) Rotalar */}
          <Route element={<ProtectedRoute />}>
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/oneriler" element={<Recommendations />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Eşleşmeyen Tüm URL'ler İçin 404 Sayfası */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;