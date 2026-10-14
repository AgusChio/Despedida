import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { said } from "../lib/said.ts";
import { useToast } from "./Toaster.tsx";

function keyBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function iosNeedsHome() {
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return apple && !standalone;
}

export function Notices() {
  const publicKey = useQuery(api.alerts.publicKey);
  const save = useMutation(api.alerts.save);
  const remove = useMutation(api.alerts.remove);
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const supported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  useEffect(() => {
    if (!supported) return;
    let cancel = false;
    void navigator.serviceWorker.getRegistration().then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!cancel && subscription) setOn(true);
    });
    return () => {
      cancel = true;
    };
  }, [supported]);

  if (publicKey === undefined) {
    return (
      <section className="notices">
        <h2>Avisos</h2>
        <p className="album-note">Cargando…</p>
      </section>
    );
  }

  if (!publicKey || !supported) return null;

  async function enable() {
    if (iosNeedsHome()) return;
    setBusy(true);
    setDenied(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(true);
        return;
      }
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey!),
        });
      }
      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) throw new Error("aviso");
      await save({
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      setOn(true);
      toast.ok("Listo. Te avisamos cuando haya algo nuevo.");
    } catch (caught) {
      toast.error(said(caught, "No se pudieron activar los avisos."));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await remove({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setOn(false);
    } catch (caught) {
      toast.error(said(caught, "No se pudieron silenciar los avisos."));
    } finally {
      setBusy(false);
    }
  }

  const home = iosNeedsHome();

  return (
    <section className="notices">
      <h2>Avisos</h2>
      <p className="album-note">
        Te avisamos cuando alguien suba fotos o videos, o confirme si viene.
      </p>
      {home ? (
        <p className="album-note">
          En el iPhone, tocá Compartir y después Agregar a inicio. Desde ese ícono se activan los avisos.
        </p>
      ) : (
        <button
          type="button"
          className={on ? "pill-button is-on" : "pill-button"}
          disabled={busy}
          onClick={() => void (on ? disable() : enable())}
        >
          {busy ? "Guardando…" : on ? "Silenciar avisos" : "Activar avisos"}
        </button>
      )}
      {denied && (
        <p className="album-note">El navegador bloqueó los avisos. Habilitalos en la configuración del sitio.</p>
      )}
    </section>
  );
}
