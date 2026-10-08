import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

const unregisterLegacyBrowserPush = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const legacyRegistrations = registrations.filter((registration) => {
    const workers = [
      registration.active,
      registration.waiting,
      registration.installing,
    ].filter(Boolean);
    return workers.some((worker) => new URL(worker.scriptURL).pathname === "/sw.js");
  });

  await Promise.all(legacyRegistrations.map(async (registration) => {
    try {
      const subscription = await registration.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
    } finally {
      await registration.unregister();
    }
  }));
};

unregisterLegacyBrowserPush().catch((error) => {
  console.warn("Could not remove the previous browser push registration:", error);
});

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
