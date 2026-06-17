(function () {
  const ROOT_SCOPE = "/";
  let serviceWorkerRegistrationPromise = null;

  function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function updateStandaloneClass() {
    document.documentElement.classList.toggle("pwa-standalone", isStandaloneMode());
    document.body?.classList.toggle("pwa-standalone", isStandaloneMode());
  }

  let deferredPrompt = null;

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

  async function requestNotificationPermission() {
    if (!window.isSecureContext || typeof window.Notification === "undefined") {
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
    showNotification: showNotification
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
