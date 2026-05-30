import { useEffect, useState } from "react";
import { api, type Plan, type Channel } from "../api";

interface PlanForm { channelId: string; name: string; priceUzs: number; durationDays: number; description: string }
const emptyForm = (): PlanForm => ({ channelId: "", name: "", priceUzs: 0, durationDays: 30, description: "" });

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-base sm:text-sm";

export default function Plans() {
  const [plans,    setPlans]    = useState<Plan[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [form,     setForm]     = useState<PlanForm>(emptyForm());
  const [editing,  setEditing]  = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");

  const load = () =>
    Promise.all([api.plans.list(), api.channels.list()])
      .then(([p, c]) => { setPlans(p); setChannels(c); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editing) {
        await api.plans.update(editing, form);
      } else {
        await api.plans.create(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm());
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Tarifni o'chirishni tasdiqlang?")) return;
    await api.plans.delete(id).catch(e => alert(e.message));
    load();
  }

  function edit(p: Plan) {
    setForm({ channelId: p.channelId, name: p.name, priceUzs: p.priceUzs, durationDays: p.durationDays, description: p.description ?? "" });
    setEditing(p.id);
    setShowForm(true);
  }

  if (loading) return <div className="p-8 text-gray-400">Yuklanmoqda…</div>;
  if (err)     return <div className="p-8 text-red-500">Xato: {err}</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Tariflar</h2>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm()); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                     hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          + Yangi tarif
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">{editing ? "Tahrirla" : "Yangi tarif"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Kanal *</label>
              <select
                value={form.channelId}
                onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
                className={inputCls}
              >
                <option value="">Tanlang…</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nomi *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="1 oy, Premium..."
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Narx (so'm) *</label>
              <input
                type="number" min={0}
                value={form.priceUzs}
                onChange={e => setForm(f => ({ ...f, priceUzs: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Davomiyligi (kun) *</label>
              <input
                type="number" min={1} max={365}
                value={form.durationDays}
                onChange={e => setForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Tavsif</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={save}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                         hover:bg-blue-700 min-h-[44px]"
            >
              Saqlash
            </button>
            <button
              onClick={() => { setShowForm(false); setEditing(null); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm
                         hover:bg-gray-200 min-h-[44px]"
            >
              Bekor
            </button>
          </div>
        </div>
      )}

      {/* Plans list */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          Hali tarif yaratilmagan. "Yangi tarif" tugmasini bosing.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* ── Mobile cards (hidden on sm+) ───────────────── */}
          <div className="sm:hidden divide-y divide-gray-100">
            {plans.map(p => (
              <div key={p.id} className={`p-4 space-y-1 ${!p.isActive ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-800 truncate">{p.name}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => edit(p)}
                      className="px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg min-h-[44px] hover:bg-blue-100"
                    >
                      Tahrir
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="px-3 py-2 text-sm text-red-500 bg-red-50 rounded-lg min-h-[44px] hover:bg-red-100"
                    >
                      O'chir
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{p.channel?.title ?? "—"}</p>
                <p className="text-sm">
                  <span className="text-green-600 font-medium">{p.priceUzs.toLocaleString()} so'm</span>
                  <span className="text-gray-400"> · {p.durationDays} kun</span>
                  {p.activeSubscribers !== undefined && (
                    <span className="text-gray-400"> · Aktiv: {p.activeSubscribers}</span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* ── Desktop table (hidden on mobile) ───────────── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Tarif</th>
                  <th className="px-4 py-3 font-medium">Kanal</th>
                  <th className="px-4 py-3 font-medium text-right">Narx</th>
                  <th className="px-4 py-3 font-medium text-right">Davom.</th>
                  <th className="px-4 py-3 font-medium text-right">Aktiv</th>
                  <th className="px-4 py-3 font-medium text-right">Amal</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 last:border-0 ${!p.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.channel?.title ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      {p.priceUzs.toLocaleString()} so'm
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.durationDays} kun</td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.activeSubscribers ?? "—"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => edit(p)} className="text-blue-500 hover:underline text-xs">Tahrir</button>
                      <button onClick={() => remove(p.id)} className="text-red-400 hover:underline text-xs">O'chir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}
