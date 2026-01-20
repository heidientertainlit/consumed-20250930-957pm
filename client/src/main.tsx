import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPostHog } from "./lib/posthog";

initPostHog();

// Register service worker for PWA - TEMPORARILY DISABLED FOR DEBUGGING
if ('serviceWorker' in navigator) {
  // Unregister existing service workers
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('SW unregistered');
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
