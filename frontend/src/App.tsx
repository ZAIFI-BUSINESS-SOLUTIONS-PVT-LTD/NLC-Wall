import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { InputPage } from "./pages/InputPage";
import { DisplayPage } from "./pages/DisplayPage";
import { AdminPage } from "./pages/AdminPage";

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem("theme") ?? "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

export function App(): React.ReactElement {
  useEffect(() => {
    // Keep DOM in sync if theme changed in another tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme" && e.newValue) {
        document.documentElement.setAttribute("data-theme", e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
