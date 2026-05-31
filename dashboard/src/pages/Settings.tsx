import { useEffect, useState } from "react";
import { api, type Creator } from "../api";

export default function Settings() {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [form,    setForm]    = useState({
    paymeMerchantId: "",
    paymeKey:        "",
    clickServiceId:  "",
    clickMerchantId: "",
    clickUserId:     "",
    clickSecret:     "",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  useEffect(() => {
    api.me.get().then(c => {
      setCreator(c);
      setForm(f => ({
        ...f,
        paymeMerchantId: c.paymeMerchantId ?? "",
        clickServiceId:  c.clickServiceId  ?? "",
        clickMerchantId: c.clickMerchantId ?? "",
        clickUserId:     c.clickUserId     ?? "",
      }));
    });
  }, []);

  async function save() {
    setSaving(true); setSaved(false); setErr("");
    const body: Record<string, string> = {};
    if (form.paymeMerchantId) body.paymeMerchantId = form.paymeMerchantId;
    if (form.paymeKey)        body.paymeKey        = form.paymeKey;
    if (form.clickServiceId)  body.clickServiceId  = form.clickServiceId;
    if (form.clickMerchantId) body.clickMerchantId = form.clickMerchantId;
    if (form.clickUserId)     body.clickUserId     = form.clickUserId;
    if (form.clickSecret)     body.clickSecret     = form.clickSecret;

    api.settings.saveMerchant(body)
      .then(() => { setSaved(true); setForm(f => ({ ...f, paymeKey: "", clickSecret: "" })); })
      .catch(e => setErr(e.message))
      .finally(() => setSaving(false));
  }

  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
  const field = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className={inp} placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Sozlamalar</h2>

      {/* Profile */}
      {creator && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Profil</h3>
          <p className="text-sm text-gray-600">
            👤 {creator.firstName ?? "—"}{creator.username && <span className="text-gray-400"> @{creator.username}</span>}
          </p>
          <p className="text-sm text-gray-500 mt-1">Telegram ID: {creator.telegramId}</p>
          <p className="text-sm text-gray-500">SaaS tarifl: <strong>{creator.saasPlan}</strong></p>
        </div>
      )}

      {/* Webhook URLs */}
      {creator && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-700 mb-1">Webhook URL'lari</h3>
          <p className="text-xs text-gray-400 mb-4">
            Quyidagi URL'larni to'lov tizimi merchant panelida webhook sifatida kiriting.
          </p>
          <div className="space-y-3">
            {[
              { label: "Payme webhook URL", url: `${window.location.origin}/payments/payme/${creator.id}` },
              { label: "Click Prepare URL", url: `${window.location.origin}/payments/click/${creator.id}/prepare` },
              { label: "Click Complete URL", url: `${window.location.origin}/payments/click/${creator.id}/complete` },
            ].map(({ label, url }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 break-all select-all">{url}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(url)}
                    className="shrink-0 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    title="Nusxalash"
                  >📋</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merchant keys */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-1">Merchant kalitlari</h3>
        <p className="text-xs text-gray-400 mb-5">
          Kalitlar bazada AES-256-GCM bilan shifrlangan holda saqlanadi (TZ §16 S-01).
          Faqat yangilamoqchi bo'lgan kalitlarni kiriting.
        </p>

        <div className="space-y-5">
          {/* Payme */}
          <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💳</span>
              <span className="font-medium text-gray-700">Payme</span>
              {creator?.hasPayme && <span className="ml-auto text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Ulangan</span>}
            </div>
            <div className="space-y-3">
              {field("Merchant ID", "paymeMerchantId", "text", "5e73...")}
              {field("Merchant Key (yangi)", "paymeKey", "password", "Yangilash uchun kiriting")}
            </div>
          </div>

          {/* Click */}
          <div className="border border-green-100 rounded-xl p-4 bg-green-50/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🟢</span>
              <span className="font-medium text-gray-700">Click</span>
              {creator?.hasClick && <span className="ml-auto text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Ulangan</span>}
            </div>
            <div className="space-y-3">
              {field("Service ID", "clickServiceId", "text", "12345")}
              {field("Merchant ID", "clickMerchantId", "text", "67890")}
              {field("Merchant User ID (ixtiyoriy)", "clickUserId", "text", "")}
              {field("Secret Key (yangi)", "clickSecret", "password", "Yangilash uchun kiriting")}
            </div>
          </div>
        </div>

        {err && <p className="mt-4 text-sm text-red-500">{err}</p>}
        {saved && <p className="mt-4 text-sm text-green-600">✅ Saqlandi!</p>}

        <button
          onClick={save}
          disabled={saving}
          className="mt-5 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}
