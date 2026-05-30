import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string | undefined;

declare global {
  interface Window {
    onTelegramAuth: (user: Record<string, unknown>) => void;
  }
}

export default function Login() {
  const navigate  = useNavigate();
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Already logged in?
    api.me.get()
      .then(() => navigate("/overview", { replace: true }))
      .catch(() => {/* not logged in — show widget */});
  }, [navigate]);

  useEffect(() => {
    if (!BOT_USERNAME || !widgetRef.current) return;

    window.onTelegramAuth = async (user) => {
      try {
        await api.auth.login(user);
        navigate("/overview", { replace: true });
      } catch {
        alert("Autentifikatsiya muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">TG Kanal</h1>
        <p className="text-sm text-gray-500 mb-8">
          Creator dashboard — pullik kanallaringizni boshqaring
        </p>

        {BOT_USERNAME ? (
          <div ref={widgetRef} className="flex justify-center" />
        ) : (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-sm text-orange-700">
            <strong>VITE_BOT_USERNAME</strong> env o'zgaruvchisi kiritilmagan.<br />
            <code className="text-xs">dashboard/.env</code> faylini yarating.
          </div>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Telegram akkauntingiz bilan kirish xavfsiz va shifrlangan.
        </p>
      </div>
    </div>
  );
}
