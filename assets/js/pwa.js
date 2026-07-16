(function () {
  const ROOT_SCOPE = "/";
  let serviceWorkerRegistrationPromise = null;
  let pushConfigPromise = null;
  let activePushEndpoint = "";

  function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function updateStandaloneClass() {
    document.documentElement.classList.toggle("pwa-standalone", isStandaloneMode());
    document.body?.classList.toggle("pwa-standalone", isStandaloneMode());
  }

  let deferredPrompt = null;

  function supportsPushNotifications() {
    return window.isSecureContext
      && "serviceWorker" in navigator
      && "PushManager" in window
      && typeof window.Notification !== "undefined";
  }

  function toBase64UrlUint8Array(value) {
    const base64 = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    const raw = window.atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return bytes;
  }

  function pushKeysMatch(subscription, expectedKey) {
    const currentKey = subscription?.options?.applicationServerKey;
    if (!currentKey || !expectedKey || currentKey.byteLength !== expectedKey.byteLength) {
      return false;
    }

    const currentBytes = new Uint8Array(currentKey);
    for (let index = 0; index < expectedKey.byteLength; index += 1) {
      if (currentBytes[index] !== expectedKey[index]) {
        return false;
      }
    }
    return true;
  }

  function buildDeviceLabel() {
    const platform = String(window.navigator.platform || "");
    const standalone = isStandaloneMode() ? "App instalado" : "Navegador";
    return [platform, standalone].filter(Boolean).join(" - ") || standalone;
  }

  function dispatchNotificationPermissionChanged() {
    window.dispatchEvent(new CustomEvent("agenda-pwa-notification-permission-changed", {
      detail: {
        permission: getNotificationPermission()
      }
    }));
  }

  function getNotificationPermission() {
    if (typeof window.Notification === "undefined") {
      return "unsupported";
    }

    return window.Notification.permission || "default";
  }

  async function ensureServiceWorkerRegistration() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return null;
    }

    if (serviceWorkerRegistrationPromise) {
      return serviceWorkerRegistrationPromise;
    }

    serviceWorkerRegistrationPromise = navigator.serviceWorker.getRegistration(ROOT_SCOPE).then(function (registration) {
      if (registration) {
        return registration;
      }

      return navigator.serviceWorker.register("/sw.js", { scope: ROOT_SCOPE });
    }).catch(function (error) {
      console.warn("[Agenda Gama] Nao foi possivel preparar o service worker para notificacoes.", error);
      return null;
    });

    return serviceWorkerRegistrationPromise;
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    try {
      serviceWorkerRegistrationPromise = navigator.serviceWorker.register("/sw.js", { scope: ROOT_SCOPE });
      await serviceWorkerRegistrationPromise;
    } catch (error) {
      console.warn("[Agenda Gama] Nao foi possivel registrar o service worker.", error);
    }
  }

  async function getPushConfig() {
    if (pushConfigPromise) {
      return pushConfigPromise;
    }

    pushConfigPromise = (async function () {
      if (!window.AgendaGamaSupabase?.invokeFunction) {
        return { publicKey: "", available: false };
      }

      try {
        const response = await window.AgendaGamaSupabase.invokeFunction("push-config", {});
        return {
          publicKey: String(response?.publicKey || ""),
          available: Boolean(response?.available)
        };
      } catch (error) {
        console.warn("[Agenda Gama] Nao foi possivel carregar a configuracao de push.", error);
        return { publicKey: "", available: false };
      }
    })();

    return pushConfigPromise;
  }

  async function requestNotificationPermission() {
    if (!supportsPushNotifications()) {
      return "unsupported";
    }

    const currentPermission = getNotificationPermission();
    if (currentPermission === "granted" || currentPermission === "denied") {
      dispatchNotificationPermissionChanged();
      return currentPermission;
    }

    try {
      const nextPermission = await window.Notification.requestPermission();
      dispatchNotificationPermissionChanged();
      return nextPermission;
    } catch (error) {
      dispatchNotificationPermissionChanged();
      return getNotificationPermission();
    }
  }

  async function syncPushSubscription() {
    if (!supportsPushNotifications() || getNotificationPermission() !== "granted") {
      return null;
    }

    const registration = await ensureServiceWorkerRegistration();
    if (!registration?.pushManager) {
      return null;
    }

    const pushConfig = await getPushConfig();
    if (!pushConfig.available || !pushConfig.publicKey) {
      return null;
    }

    const applicationServerKey = toBase64UrlUint8Array(pushConfig.publicKey);
    let subscription = await registration.pushManager.getSubscription();

    // A subscription created with an old VAPID key cannot receive background pushes.
    if (subscription && !pushKeysMatch(subscription, applicationServerKey)) {
      const staleEndpoint = String(subscription.endpoint || "");
      try {
        await subscription.unsubscribe();
      } catch (error) {
        console.warn("[Agenda Gama] Nao foi possivel renovar a assinatura antiga de push.", error);
      }

      if (window.AgendaGamaSupabase?.invokeFunction && staleEndpoint) {
        try {
          await window.AgendaGamaSupabase.invokeFunction("remove-push-subscription", {
            endpoint: staleEndpoint
          });
        } catch (error) {
          console.warn("[Agenda Gama] Nao foi possivel remover a assinatura antiga do servidor.", error);
        }
      }
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    }

    activePushEndpoint = String(subscription.endpoint || "");

    if (window.AgendaGamaSupabase?.invokeFunction) {
      await window.AgendaGamaSupabase.invokeFunction("upsert-push-subscription", {
        subscription: subscription.toJSON(),
        deviceLabel: buildDeviceLabel(),
        userAgent: window.navigator.userAgent || ""
      });
    }

    return subscription;
  }

  async function removePushSubscription(options) {
    const registration = await ensureServiceWorkerRegistration();
    const subscription = registration?.pushManager
      ? await registration.pushManager.getSubscription()
      : null;
    const endpoint = String(options?.endpoint || subscription?.endpoint || activePushEndpoint || "");

    if (window.AgendaGamaSupabase?.invokeFunction && endpoint) {
      try {
        await window.AgendaGamaSupabase.invokeFunction("remove-push-subscription", {
          endpoint: endpoint
        });
      } catch (error) {
        console.warn("[Agenda Gama] Nao foi possivel remover a assinatura de push.", error);
      }
    }

    if (subscription && options?.unsubscribe !== false) {
      try {
        await subscription.unsubscribe();
      } catch (error) {
        console.warn("[Agenda Gama] Nao foi possivel cancelar a assinatura local de push.", error);
      }
    }

    activePushEndpoint = "";
    return true;
  }

  async function hasPushSubscription() {
    const registration = await ensureServiceWorkerRegistration();
    if (!registration?.pushManager) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    activePushEndpoint = String(subscription?.endpoint || activePushEndpoint || "");
    return Boolean(subscription);
  }

  async function showNotification(options) {
    if (getNotificationPermission() !== "granted") {
      return false;
    }

    const registration = await ensureServiceWorkerRegistration();
    if (!registration || typeof registration.showNotification !== "function") {
      return false;
    }

    const title = String(options?.title || "Agenda Gama");
    const body = String(options?.body || "");
    const href = String(options?.href || options?.url || "/app/dashboard.html");

    await registration.showNotification(title, {
      body: body,
      tag: String(options?.tag || options?.id || `agenda-gama-${Date.now()}`),
      lang: "pt-BR",
      badge: "/assets/icons/icon-192.png",
      icon: "/assets/icons/icon-192.png",
      renotify: false,
      data: {
        href: href,
        id: String(options?.id || ""),
        kind: String(options?.kind || "")
      }
    });
    return true;
  }

  async function promptInstall() {
    if (!deferredPrompt) return false;

    const pendingPrompt = deferredPrompt;
    deferredPrompt = null;
    document.documentElement.classList.remove("pwa-installable");

    pendingPrompt.prompt();
    try {
      const result = await pendingPrompt.userChoice;
      return result?.outcome === "accepted";
    } catch (error) {
      return false;
    }
  }

  function isIosBrowser() {
    const ua = window.navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua);
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    document.documentElement.classList.add("pwa-installable");
    window.dispatchEvent(new CustomEvent("agenda-pwa-installable"));
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    document.documentElement.classList.remove("pwa-installable");
    updateStandaloneClass();
    window.dispatchEvent(new CustomEvent("agenda-pwa-installed"));
  });

  window.AgendaGamaPWA = {
    isStandalone: isStandaloneMode,
    isIosBrowser: isIosBrowser,
    canInstall: function () {
      return Boolean(deferredPrompt);
    },
    promptInstall: promptInstall,
    requestNotificationPermission: requestNotificationPermission,
    getNotificationPermission: getNotificationPermission,
    showNotification: showNotification,
    syncPushSubscription: syncPushSubscription,
    removePushSubscription: removePushSubscription,
    hasPushSubscription: hasPushSubscription,
    supportsPushNotifications: supportsPushNotifications
  };

  window.dispatchEvent(new CustomEvent("agenda-pwa-ready"));
  dispatchNotificationPermissionChanged();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateStandaloneClass, { once: true });
  } else {
    updateStandaloneClass();
  }

  window.addEventListener("load", registerServiceWorker, { once: true });
})();
