import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, type Creator } from "../api";

const baseNav = [
  { to: "/overview",    label: "📊 Overview" },
  { to: "/channels",    label: "📢 Kanallar" },
  { to: "/plans",       label: "📦 Tariflar" },
  { to: "/subscribers", label: "👥 Obunachilar" },
  { to: "/settings",    label: "⚙️ Sozlamalar" },
];

export default function Layout() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.me.get()
      .then(setCreator)
      .catch(() => navigate("/login", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleLogout() {
    await api.auth.logout().catch(() => {});
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h1 className="font-bold text-lg text-blue-600">TG Kanal</h1>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {creator?.firstName ?? creator?.username ?? "Creator"}
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[...baseNav, ...(creator?.isAdmin ? [{ to: "/admin", label: "🛡️ Admin" }] : [])].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          {creator && (
            <div className="px-3 py-2 text-xs text-gray-400 mb-1">
              {creator.hasPayme && <span className="mr-2">💳 Payme</span>}
              {creator.hasClick && <span>🟢 Click</span>}
              {!creator.hasPayme && !creator.hasClick && (
                <span className="text-orange-400">⚠️ Merchant ulanmagan</span>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
          >
            🚪 Chiqish
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
