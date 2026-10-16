import { createRoot } from "react-dom/client";
import { ConversationStudio, ConversationWorkspaceView, type ConversationState } from "./persona-conversation-controls";
import "@/index.css";

const state: ConversationState = {
  personas: [
    { id: "p-1", user_name: "mara_reads", display_name: "Mara Ellis", persona_config: null },
    { id: "p-2", user_name: "devon_film", display_name: "Devon Park", persona_config: null },
  ],
  runs: [],
};

async function transport(action: string, values: Record<string, unknown>) {
  const response = await fetch("/__fixture/admin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...values }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Fixture request failed");
  return result;
}

createRoot(document.getElementById("root")!).render(
  <main className="min-h-dvh bg-gray-950 p-4 text-gray-100">
    <ConversationWorkspaceView state={state} showSnapshots={false} />
    <ConversationStudio state={state} transport={transport} />
  </main>,
);
