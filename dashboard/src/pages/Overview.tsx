import { useEffect, useState } from "react";
import { api, type Stats, type Channel } from "../api";

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

export default function Overview() {
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [err,      setErr]      = useState("");

  useEffect(() => {
    Promise.all([api.stats.get(), api.channels.list()])
      .then(([s, c]) => { setStats(s); setChannels(c); })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="p-8 text-red-500">Xato: {err}</div>;
  if (!stats) return <div className="p-8 text-gray-400">Yuklanmoqda…</div>;

  return (
    <div className="p-8 max-w-5xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Umumiy ko'rsatkichlar</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="💰" label="Jami daromad"    value={fmt(stats.totalRevenue)} />
        <StatCard icon="📅" label="Bu oy daromad"   value={fmt(stats.monthlyRevenue)} />
        <StatCard icon="✅" label="Aktiv obunachilar" value={String(stats.activeSubscribersCount)} />
        <StatCard icon="👥" label="Jami obunachilar"  value={String(stats.totalSubscribersCount)} />
      </div>

      {/* Plan breakdown */}
      {stats.planBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-8">
          <h3 className="font-semibold text-gray-700 mb-4">Tariflar bo'yicha</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Tarif</th>
                <th className="pb-2 font-medium text-right">Obunachilar</th>
                <th className="pb-2 font-medium text-right">Daromad</th>
              </tr>
            </thead>
            <tbody>
              {stats.planBreakdown.map(p => (
                <tr key={p.planId} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-700">{p.planName}</td>
                  <td className="py-2 text-right text-gray-600">{p.count}</td>
                  <td className="py-2 text-right font-medium text-green-600">{fmt(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Channels */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Kanallar</h3>
        {channels.length === 0 ? (
          <p className="text-sm text-gray-400">Hali kanallar ulanmagan. Bot orqali kanal ulang.</p>
        ) : (
          <div className="space-y-3">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="font-medium text-gray-800">{ch.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ch.plans.length} tarif · {ch.activeSubscribers} aktiv obunachi
                  </p>
                </div>
                <a
                  href={ch.deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  Havola →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
