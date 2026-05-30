import { useEffect, useState } from "react";
import { api, type AdminCreator, type AdminStats } from "../api";

const PLAN_COLORS: Record<string, string> = {
  FREE:     "bg-gray-100 text-gray-600",
  PRO:      "bg-blue-100 text-blue-700",
  BUSINESS: "bg-purple-100 text-purple-700",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-800">{value}</p>
    </div>
  );
}

interface PlanModalProps {
  creator: AdminCreator;
  onClose: () => void;
  onSave: (id: string, plan: string, expiresAt: string | null) => Promise<void>;
}

function PlanModal({ creator, onClose, onSave }: PlanModalProps) {
  const [plan, setPlan] = useState(creator.saasPlan);
  const [expiresAt, setExpiresAt] = useState(
    creator.saasExpiresAt ? creator.saasExpiresAt.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setSaving(true);
    setErr("");
    try {
      const isoExpiry = expiresAt ? new Date(expiresAt).toISOString() : null;
      await onSave(creator.id, plan, isoExpiry);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xato yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-1">Tarif o'zgartirish</h3>
        <p className="text-sm text-gray-500 mb-5">
          {creator.firstName ?? creator.username ?? creator.telegramId}
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">SaaS tarif</label>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as "FREE" | "PRO" | "BUSINESS")}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="FREE">FREE — 1 kanal, 5 tarif</option>
          <option value="PRO">PRO — 3 kanal, 20 tarif</option>
          <option value="BUSINESS">BUSINESS — cheksiz</option>
        </select>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Muddati tugash sanasi (ixtiyoriy)
        </label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {err && <p className="text-red-500 text-sm mb-3">{err}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<AdminCreator | null>(null);

  async function load(p = 1) {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([api.admin.stats(), api.admin.creators(p)]);
      setStats(s);
      setCreators(c.creators);
      setTotal(c.total);
      setPage(p);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
        setForbidden(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleSavePlan(id: string, plan: string, expiresAt: string | null) {
    await api.admin.setPlan(id, plan, expiresAt);
    await load(page);
  }

  if (forbidden) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-4xl mb-3">🔒</p>
        <p className="font-semibold text-gray-700">Kirish taqiqlangan</p>
        <p className="text-sm mt-1">Faqat platform admin uchun mavjud.</p>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">🛡️ Platform Admin</h2>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Jami creatorlar" value={stats.totalCreators} />
          <StatCard label="Faol kanallar"  value={stats.totalChannels} />
          <StatCard label="Aktiv obunalar" value={stats.totalActiveSubs} />
          <StatCard
            label="Jami daromad"
            value={`${stats.totalRevenue.toLocaleString()} so'm`}
          />
        </div>
      )}

      {/* Creators table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">
            Creatorlar ({total} ta)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Creator</th>
                <th className="px-4 py-3 text-left">Tarif</th>
                <th className="px-4 py-3 text-center">Kanallar</th>
                <th className="px-4 py-3 text-center">Aktiv subs</th>
                <th className="px-4 py-3 text-right">Daromad</th>
                <th className="px-4 py-3 text-center">To'lov</th>
                <th className="px-4 py-3 text-center">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {creators.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">
                      {c.firstName ?? c.username ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      @{c.username ?? c.telegramId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        PLAN_COLORS[c.saasPlan] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.saasPlan}
                    </span>
                    {c.saasExpiresAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(c.saasExpiresAt).toLocaleDateString("ru-RU")}gacha
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {c.channelCount}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {c.activeSubs}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {c.totalRevenue.toLocaleString()} so'm
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {c.hasPayme && <span className="mr-1">💳</span>}
                    {c.hasClick && <span>🟢</span>}
                    {!c.hasPayme && !c.hasClick && (
                      <span className="text-orange-400">⚠️</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setEditing(c)}
                      className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      Tarif
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{total} ta creator</p>
            <div className="flex gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Oldingi
              </button>
              <span className="px-3 py-1 text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Keyingi →
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <PlanModal
          creator={editing}
          onClose={() => setEditing(null)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  );
}
