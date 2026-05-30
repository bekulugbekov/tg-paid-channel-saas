import { useEffect, useState } from "react";
import { api, type Channel } from "../api";

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");

  useEffect(() => {
    api.channels.list()
      .then(setChannels)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Yuklanmoqda…</div>;
  if (err)     return <div className="p-8 text-red-500">Xato: {err}</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Kanallar</h2>

      {channels.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">📢</div>
          <p className="text-gray-500 mb-2">Hali kanallar ulanmagan.</p>
          <p className="text-sm text-gray-400">
            Botni kanalingizga admin qilib qo'shing, kanal avtomatik ro'yxatga olinadi.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{ch.title}</h3>
                  {ch.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{ch.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>📦 {ch.plans.length} tarif</span>
                    <span>✅ {ch.activeSubscribers} aktiv obunachi</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ch.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}>
                    {ch.isActive ? "Faol" : "O'chirilgan"}
                  </span>
                  <a
                    href={ch.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Havola →
                  </a>
                </div>
              </div>

              {ch.plans.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-400 mb-2">TARIFLAR</p>
                  <div className="flex flex-wrap gap-2">
                    {ch.plans.map((p) => (
                      <span
                        key={p.id}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg"
                      >
                        {p.name} — {p.priceUzs.toLocaleString()} so'm / {p.durationDays} kun
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Kanal ulash: botga /creator yuboring → kanal adminlariga botni qo'shing.
      </p>
    </div>
  );
}
