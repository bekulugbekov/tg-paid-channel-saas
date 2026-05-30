import { useEffect, useState } from "react";
import { api, type Subscription, type Channel } from "../api";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    "✅ Aktiv",
  PENDING:   "⏳ Kutilmoqda",
  EXPIRED:   "❌ Tugagan",
  CANCELLED: "🚫 Bekor",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-50 text-green-700",
  PENDING:   "bg-yellow-50 text-yellow-700",
  EXPIRED:   "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-50 text-red-500",
};

function dateFmt(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Subscribers() {
  const [subs,     setSubs]     = useState<Subscription[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filter,   setFilter]   = useState<{ status: string; channelId: string }>({ status: "", channelId: "" });
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filter.status)    params.status    = filter.status;
    if (filter.channelId) params.channelId = filter.channelId;

    Promise.all([api.subscribers.list(params), channels.length ? Promise.resolve(channels) : api.channels.list()])
      .then(([s, c]) => { setSubs(s); setChannels(c); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  async function extend(sub: Subscription) {
    const daysStr = prompt("Necha kun uzaytirish?", "30");
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 1) return;
    await api.subscribers.extend(sub.id, days).catch(e => alert(e.message));
    load();
  }

  async function revoke(sub: Subscription) {
    if (!confirm(`${sub.subscriber.firstName ?? sub.subscriber.username ?? sub.subscriber.telegramId} obunasini bekor qilinsinmi?`)) return;
    await api.subscribers.revoke(sub.id).catch(e => alert(e.message));
    load();
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Obunachilar</h2>
        <div className="flex gap-3">
          <select
            value={filter.channelId}
            onChange={e => setFilter(f => ({ ...f, channelId: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Barcha kanallar</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select
            value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Barcha holat</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="PENDING">Kutilmoqda</option>
            <option value="EXPIRED">Tugagan</option>
            <option value="CANCELLED">Bekor</option>
          </select>
        </div>
      </div>

      {err ? (
        <div className="text-red-500 p-4">{err}</div>
      ) : loading ? (
        <div className="text-gray-400 p-8">Yuklanmoqda…</div>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          Obunachilar topilmadi
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Foydalanuvchi</th>
                <th className="px-4 py-3 font-medium">Kanal / Tarif</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Boshlanish</th>
                <th className="px-4 py-3 font-medium">Tugash</th>
                <th className="px-4 py-3 font-medium text-right">Amal</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">
                      {s.subscriber.firstName ?? s.subscriber.username ?? `ID: ${s.subscriber.telegramId}`}
                    </p>
                    {s.subscriber.username && (
                      <p className="text-xs text-gray-400">@{s.subscriber.username}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{s.channel.title}</p>
                    <p className="text-xs text-gray-400">{s.plan.name} · {s.plan.priceUzs.toLocaleString()} so'm</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{dateFmt(s.startedAt)}</td>
                  <td className="px-4 py-3 text-gray-500">{dateFmt(s.expiresAt)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => extend(s)} className="text-blue-500 hover:underline text-xs">Uzaytir</button>
                    {s.status === "ACTIVE" && (
                      <button onClick={() => revoke(s)} className="text-red-400 hover:underline text-xs">Chiqar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
