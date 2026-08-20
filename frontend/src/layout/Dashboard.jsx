import { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Dashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="mu-app-shell">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="mu-main">
        <Navbar onToggleSidebar={() => setMobileOpen((v) => !v)} />
        <main className="mu-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
