import { useEffect, useState } from "react";
import { api, type Stats, type Channel, type Creator } from "../api";

const PLAN_INFO: Record<string, { label: string; color: string; channels: number; plans: number }> = {
  FREE:     { label: "FREE",     color: "bg-gray-100 text-gray-600",    channels: 1,   plans: 5   },
  PRO:      { label: "PRO",      color: "bg-blue-100 text-blue-700",    channels: 3,   plans: 20  },
  BUSINESS: { label: "BUSINESS", color: "bg-purple-100 text-purple-700", channels: 999, plans: 999 },
};

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
  const [creator,  setCreator]  = useState<Creator | null>(null);
  const [err,      setErr]      = useState("");

  useEffect(() => {
    Promise.all([api.stats.get(), api.channels.list(), api.me.get()])
      .then(([s, c, me]) => { setStats(s); setChannels(c); setCreator(me); })
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="p-8 text-red-500">Xato: {err}</div>;
  if (!stats) return <div className="p-8 text-gray-400">Yuklanmoqda…</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Umumiy ko'rsatkichlar</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard icon="💰" label="Jami daromad"    value={fmt(stats.totalRevenue)} />
        <StatCard icon="📅" label="Bu oy daromad"   value={fmt(stats.monthlyRevenue)} />
        <StatCard icon="✅" label="Aktiv obunachilar" value={String(stats.activeSubscribersCount)} />
        <StatCard icon="👥" label="Jami obunachilar"  value={String(stats.totalSubscribersCount)} />
      </div>

      {/* Plan breakdown */}
      {stats.planBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-8">
          <h3 className="font-semibold text-gray-700 mb-4">Tariflar bo'yicha</h3>
          <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[280px]">
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
        </div>
      )}

      {/* SaaS Plan */}
      {creator && (() => {
        const plan = PLAN_INFO[creator.saasPlan] ?? PLAN_INFO.FREE;
        const channelCount = channels.filter(c => c.isActive).length;
        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${plan.color}`}>
                {plan.label}
              </span>
              <span className="text-sm text-gray-500">Sizning SaaS tarifingiz</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 sm:ml-auto">
              <span>
                📺 Kanallar: <strong>{channelCount}</strong>
                {plan.channels < 999 && <span className="text-gray-400"> / {plan.channels}</span>}
              </span>
              <span>
                📦 Tariflar: <strong>{stats?.planBreakdown.length ?? 0}</strong>
                {plan.plans < 999 && <span className="text-gray-400"> / {plan.plans}</span>}
              </span>
            </div>
          </div>
        );
      })()}

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
