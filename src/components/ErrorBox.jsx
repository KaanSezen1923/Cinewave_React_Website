export function ErrorBox({ message }) {
    return (
        <div style={{
            padding: "16px 20px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            color: "#fca5a5",
            margin: "20px 0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "0.95rem"
        }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <span>{message || "Bir hata oluştu. Lütfen tekrar deneyin."}</span>
        </div>
    );
}
export default ErrorBox;