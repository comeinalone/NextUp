import { createContext, useCallback, useContext, useState } from "react";

const ToastCtx = createContext({ error: console.error, info: console.log });
export const useToast = () => useContext(ToastCtx);

// Wrap <App /> in <ToastProvider>. Any page can then do: const toast = useToast(); toast.error(err.message)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, text) => {
    const id = Math.random();
    setItems((cur) => [...cur, { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000);
  }, []);
  const api = { error: (t) => push("error", t), info: (t) => push("info", t) };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 inset-x-4 z-50 flex flex-col items-center gap-2 pointer-events-none" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.kind === "error" ? "bg-critical" : "bg-ink"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
