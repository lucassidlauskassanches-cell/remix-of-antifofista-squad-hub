import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff } from "lucide-react";
import { savePushSubscription, removePushSubscription } from "@/lib/push.functions";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Status = "loading" | "unsupported" | "denied" | "idle" | "subscribed";

export function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) {
        setStatus("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js");
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (Notification.permission === "denied") {
          setStatus("denied");
          return;
        }
        if (existing) {
          setEndpoint(existing.endpoint);
          setStatus("subscribed");
        } else {
          setStatus("idle");
        }
      } catch (e) {
        console.error("[push] init failed", e);
        setStatus("unsupported");
      }
    })();
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "idle");
        toast.error("Permissão de notificações negada.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey("auth"));
      await save({
        data: {
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      setEndpoint(sub.endpoint);
      setStatus("subscribed");
      toast.success("Notificações ativadas.");
    } catch (e) {
      console.error("[push] subscribe failed", e);
      toast.error("Não foi possível ativar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await remove({ data: { endpoint: sub.endpoint } });
        } catch (_) {}
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setStatus("idle");
      toast.success("Notificações desativadas.");
    } catch (e) {
      console.error("[push] unsubscribe failed", e);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  const isOn = status === "subscribed";
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {isOn ? <Bell className="w-5 h-5 text-primary shrink-0" /> : <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <div className="font-semibold text-sm uppercase tracking-wide">Notificações</div>
          <div className="text-xs text-muted-foreground">
            {status === "denied"
              ? "Bloqueadas pelo navegador — ative nas configurações do sistema."
              : isOn
                ? "Você vai receber lembretes de água, treino e resgate."
                : "Ative para receber lembretes motivadores no seu dia."}
          </div>
        </div>
      </div>
      {status !== "denied" && (
        <button
          type="button"
          onClick={isOn ? disable : enable}
          disabled={busy}
          className={
            "shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors " +
            (isOn
              ? "border border-border text-foreground hover:bg-muted"
              : "bg-primary text-primary-foreground hover:opacity-90")
          }
        >
          {busy ? "..." : isOn ? "Desativar" : "Ativar"}
        </button>
      )}
    </div>
  );
}
