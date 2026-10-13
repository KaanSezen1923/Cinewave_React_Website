export function Skeleton({ count = 8 }) {
    return (
        <div className="movie-grid">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        borderRadius: "var(--radius-md)",
                        background: "linear-gradient(110deg, #161a26 8%, #1f2434 18%, #161a26 33%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.5s linear infinite",
                        aspectRatio: "2 / 3",
                        border: "1px solid var(--border-subtle)"
                    }}
                />
            ))}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
}
export default Skeleton;