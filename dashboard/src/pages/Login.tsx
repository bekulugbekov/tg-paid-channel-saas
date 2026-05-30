import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string | undefined;

declare global {
  interface Window {
    onTelegramAuth: (user: Record<string, unknown>) => void;
  }
}

export default function Login() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const widgetRef      = useRef<HTMLDivElement>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in?
  useEffect(() => {
    api.me.get()
      .then(() => navigate("/overview", { replace: true }))
      .catch(() => {/* not logged in */});
  }, [navigate]);

  // Magic link: ?token=<token> in URL
  useEffect(() => {
    const token = params.get("token");
    if (!token) return;

    setLoading(true);
    api.auth.magicLogin(token)
      .then(() => navigate("/overview", { replace: true }))
      .catch((err: Error) => {
        // Parse human-readable error from server
        let msg = "Havola yaroqsiz yoki muddati o'tgan.";
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error) msg = parsed.error;
        } catch {
          if (err.message) msg = err.message;
        }
        setError(msg);
        setLoading(false);
      });
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telegram Login Widget (fallback)
  useEffect(() => {
    if (!BOT_USERNAME || !widgetRef.current) return;

    window.onTelegramAuth = async (user) => {
      try {
        await api.auth.login(user);
        navigate("/overview", { replace: true });
      } catch {
        setError("Autentifikatsiya muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    widgetRef.current.appendChild(script);

    return () => { widgetRef.current?.removeChild(script); };
  }, [navigate]);

  const hasMagicToken = !!params.get("token");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">TG Kanal</h1>
        <p className="text-sm text-gray-500 mb-8">
          Creator dashboard — pullik kanallaringizni boshqaring
        </p>

        {/* Magic link loading state */}
        {hasMagicToken && loading && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
            ⏳ Kirish tekshirilmoqda...
          </div>
        )}

        {/* Magic link error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
            ❌ {error}
            <div className="mt-2 text-xs text-red-500">
              Botda <code>/dashboard</code> buyrug'ini qayta yuboring.
            </div>
          </div>
        )}

        {/* Telegram Login Widget — show only when no magic token in URL */}
        {!hasMagicToken && (
          BOT_USERNAME ? (
            <div ref={widgetRef} className="flex justify-center" />
          ) : (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-sm text-orange-700">
              <strong>VITE_BOT_USERNAME</strong> env o'zgaruvchisi kiritilmagan.<br />
              <code className="text-xs">dashboard/.env</code> faylini yarating.
            </div>
          )
        )}

        <p className="mt-8 text-xs text-gray-400">
          Kirish uchun botda <code>/dashboard</code> buyrug'ini yuboring.
        </p>
      </div>
    </div>
  );
}
