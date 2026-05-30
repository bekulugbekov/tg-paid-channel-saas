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
  const [creator,     setCreator]     = useState<Creator | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
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

  const navItems = [
    ...baseNav,
    ...(creator?.isAdmin ? [{ to: "/admin", label: "🛡️ Admin" }] : []),
  ];

  const merchantStatus = creator && (
    <div className="px-3 py-2 text-xs text-gray-400">
      {creator.hasPayme && <span className="mr-2">💳 Payme</span>}
      {creator.hasClick && <span>🟢 Click</span>}
      {!creator.hasPayme && !creator.hasClick && (
        <span className="text-orange-400">⚠️ Merchant ulanmagan</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">

      {/* ── Mobile top header ─────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between
                         bg-white border-b border-gray-200 px-4 h-14 shrink-0">
        <h1 className="font-bold text-blue-600">TG Kanal</h1>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center w-11 h-11 rounded-lg
                     text-gray-600 hover:bg-gray-100 text-xl"
          aria-label="Menyuni ochish"
        >
          ☰
        </button>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          onClick={() => setDrawerOpen(false)}
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* panel */}
          <div
            className="relative w-64 max-w-[85vw] bg-white h-full flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="min-w-0">
                <h1 className="font-bold text-lg text-blue-600">TG Kanal</h1>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {creator?.firstName ?? creator?.username ?? "Creator"}
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-center w-11 h-11 rounded-lg
                           text-gray-400 hover:bg-gray-100 shrink-0 text-lg"
                aria-label="Yopish"
              >
                ✕
              </button>
            </div>

            {/* nav */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-3 rounded-lg text-sm font-medium
                     transition-colors min-h-[44px] ${
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

            {/* footer */}
            <div className="p-3 border-t border-gray-100">
              {merchantStatus}
              <button
                onClick={handleLogout}
                className="w-full px-3 min-h-[44px] text-sm text-gray-500
                           hover:text-red-600 hover:bg-red-50 rounded-lg
                           transition-colors text-left"
              >
                🚪 Chiqish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <h1 className="font-bold text-lg text-blue-600">TG Kanal</h1>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {creator?.firstName ?? creator?.username ?? "Creator"}
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label }) => (
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
          {merchantStatus}
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm text-gray-500
                       hover:text-red-600 hover:bg-red-50 rounded-lg
                       transition-colors text-left"
          >
            🚪 Chiqish
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
