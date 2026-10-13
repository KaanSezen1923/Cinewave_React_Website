import ChatPanel from "../components/ChatPanel";

export default function Discover() {
    return (
        <div style={{ flex: 1, minHeight: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <ChatPanel />
        </div>
    );
}