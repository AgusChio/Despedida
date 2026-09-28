import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "note" | "ok" | "error" | "ask";

type Item = {
  id: number;
  text: string;
  tone: Tone;
  yes?: string;
  no?: string;
  onYes?: () => void;
};

type ToastApi = {
  note: (text: string) => void;
  ok: (text: string) => void;
  error: (text: string) => void;
  ask: (text: string, onYes: () => void, yes?: string, no?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("Falta el toaster.");
  return toast;
}

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<Item, "id">) => {
      const id = ++seq.current;
      setItems((current) => {
        const next = [...current, { ...item, id }];
        const asks = next.filter((entry) => entry.tone === "ask");
        const rest = next.filter((entry) => entry.tone !== "ask").slice(-2);
        return [...rest, ...asks].slice(-4);
      });
      if (item.tone !== "ask") {
        window.setTimeout(() => dismiss(id), 3800);
      }
    },
    [dismiss],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      note: (text) => push({ text, tone: "note" }),
      ok: (text) => push({ text, tone: "ok" }),
      error: (text) => push({ text, tone: "error" }),
      ask: (text, onYes, yes = "Sí", no = "No") =>
        push({ text, tone: "ask", yes, no, onYes }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toaster" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`} role="status">
            <p>{item.text}</p>
            {item.tone === "ask" && (
              <div className="toast-actions">
                <button type="button" onClick={() => dismiss(item.id)}>
                  {item.no}
                </button>
                <button
                  type="button"
                  className="toast-yes"
                  onClick={() => {
                    dismiss(item.id);
                    item.onYes?.();
                  }}
                >
                  {item.yes}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
