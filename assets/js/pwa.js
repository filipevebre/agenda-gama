(function () {
  const ROOT_SCOPE = "/";
  let serviceWorkerRegistrationPromise = null;
  let pushConfigPromise = null;
  let activePushEndpoint = "";
  let activeNativePushToken = "";
  let nativePushListenersPromise = null;
  let nativePushRegistrationPromise = null;
  let nativeAppLinksPromise = null;
  let nativeRegistrationWaiter = null;
  let nativeNotificationPermission = "default";

  const NATIVE_TOKEN_KEY = "agenda-gama-native-push-token";
  const NATIVE_CHANNEL_ID = "agenda_gama_alerts";

  function isNativePlatform() {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  }

  function getNativePushPlugin() {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.PushNotifications || null;
  }

  function getNativeAppPlugin() {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.App || null;
  }

  function getNativeBrowserPlugin() {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.Browser || null;
  }

  async function getNativeAppInfo() {
    const plugin = getNativeAppPlugin();
    if (!plugin?.getInfo) return null;

    try {
      return await plugin.getInfo();
    } catch (error) {
      console.warn("[Agenda Gama] Nao foi possivel consultar a versao instalada.", error);
      return null;
    }
  }

  async function openExternalUrl(url) {
    const normalizedUrl = String(url || "").trim();
    if (!/^https:\/\//i.test(normalizedUrl)) return false;

    const browser = getNativeBrowserPlugin();
    if (browser?.open) {
      await browser.open({ url: normalizedUrl });
      return true;
    }

    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  function isStandaloneMode() {
    return isNativePlatform()
      || window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  }

  function updateStandaloneClass() {
    document.documentElement.classList.toggle("pwa-standalone", isStandaloneMode());
    document.body?.classList.toggle("pwa-standalone", isStandaloneMode());
  }

  let deferredPrompt = null;

  function supportsPushNotifications() {
    if (getNativePushPlugin()) return true;
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
    if (isNativePlatform()) {
      const platform = String(window.Capacitor?.getPlatform?.() || "app");
      return `Agenda Gama - ${platform}`;
    }

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
    if (getNativePushPlugin()) {
      return nativeNotificationPermission;
    }

    if (typeof window.Notification === "undefined") {
      return "unsupported";
    }

    return window.Notification.permission || "default";
  }

  function normalizeNativePermission(permission) {
    if (permission === "granted" || permission === "denied") return permission;
    return "default";
  }

  async function refreshNativeNotificationPermission() {
    const plugin = getNativePushPlugin();
    if (!plugin) return getNotificationPermission();

    try {
      const status = await plugin.checkPermissions();
      nativeNotificationPermission = normalizeNativePermission(status?.receive);
    } catch (error) {
      console.warn("[Agenda Gama] Nao foi possivel consultar a permissao nativa de push.", error);
      nativeNotificationPermission = "default";
    }

    dispatchNotificationPermissionChanged();
    return nativeNotificationPermission;
  }

  async function syncNativeTokenToServer(token) {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken || !window.AgendaGamaSupabase?.invokeFunction) return false;

    await window.AgendaGamaSupabase.invokeFunction("upsert-native-push-token", {
      token: normalizedToken,
      platform: String(window.Capacitor?.getPlatform?.() || "android"),
      deviceLabel: buildDeviceLabel(),
      userAgent: window.navigator.userAgent || ""
    });
    return true;
  }

  function normalizeAppHref(href) {
    const normalizedHref = String(href || "").trim();
    if (!normalizedHref) return "";

    try {
      const siteUrl = String(window.AgendaGamaConfig?.siteUrl || "https://agenda-gama.vercel.app");
      const customScheme = "br.com.agendagama.app://";
      const targetValue = normalizedHref.startsWith(customScheme)
        ? `${siteUrl.replace(/\/$/, "")}/${normalizedHref.slice(customScheme.length).replace(/^\//, "")}`
        : normalizedHref;
      const target = new URL(targetValue, siteUrl);
      const expectedOrigin = new URL(siteUrl).origin;
      if (target.origin !== expectedOrigin) return "";
      return `${target.pathname}${target.search}${target.hash}`;
    } catch (error) {
      console.warn("[Agenda Gama] Destino invalido recebido na notificacao nativa.", error);
      return "";
    }
  }

  function openNativeNotificationDestination(href) {
    const localHref = normalizeAppHref(href);
    if (!localHref) return;
    window.location.href = localHref;
  }

  async function ensureNativeAppLinks() {
    const plugin = getNativeAppPlugin();
    if (!plugin) return false;
    if (nativeAppLinksPromise) return nativeAppLinksPromise;

    nativeAppLinksPromise = (async function () {
      await plugin.addListener("appUrlOpen", function (event) {
        openNativeNotificationDestination(event?.url || "");
      });

      const launch = await plugin.getLaunchUrl().catch(function () {
        return null;
      });
      if (launch?.url) {
        window.setTimeout(function () {
          openNativeNotificationDestination(launch.url);
        }, 0);
      }
      return true;
    })().catch(function (error) {
      nativeAppLinksPromise = null;
      console.warn("[Agenda Gama] Nao foi possivel preparar os links internos do app.", error);
      return false;
    });

    return nativeAppLinksPromise;
  }

  async function ensureNativePushListeners() {
    const plugin = getNativePushPlugin();
    if (!plugin) return false;
    if (nativePushListenersPromise) return nativePushListenersPromise;

    nativePushListenersPromise = (async function () {
      activeNativePushToken = String(window.localStorage.getItem(NATIVE_TOKEN_KEY) || "");

      await plugin.addListener("registration", function (token) {
        activeNativePushToken = String(token?.value || "").trim();
        if (activeNativePushToken) {
          window.localStorage.setItem(NATIVE_TOKEN_KEY, activeNativePushToken);
          void syncNativeTokenToServer(activeNativePushToken).catch(function (error) {
            console.warn("[Agenda Gama] Nao foi possivel salvar o aparelho para push nativo.", error);
          });
        }
        nativeRegistrationWaiter?.resolve?.(activeNativePushToken);
        nativeRegistrationWaiter = null;
      });

      await plugin.addListener("registrationError", function (error) {
        console.error("[Agenda Gama] O Firebase nao registrou este aparelho.", error);
        nativeRegistrationWaiter?.reject?.(new Error(String(error?.error || "Falha no registro do Firebase.")));
        nativeRegistrationWaiter = null;
      });

      await plugin.addListener("pushNotificationReceived", function (notification) {
        window.dispatchEvent(new CustomEvent("agenda-native-push-received", {
          detail: notification
        }));
      });

      await plugin.addListener("pushNotificationActionPerformed", function (action) {
        const notification = action?.notification || {};
        const data = notification.data || {};
        const href = data.href || data.url || notification.link || "";
        window.dispatchEvent(new CustomEvent("agenda-native-push-opened", {
          detail: data
        }));
        openNativeNotificationDestination(href);
      });

      return true;
    })().catch(function (error) {
      nativePushListenersPromise = null;
      console.error("[Agenda Gama] Nao foi possivel iniciar as notificacoes nativas.", error);
      return false;
    });

    return nativePushListenersPromise;
  }

  async function createNativeNotificationChannel() {
    const plugin = getNativePushPlugin();
    if (!plugin || String(window.Capacitor?.getPlatform?.() || "") !== "android") return;

    await plugin.createChannel({
      id: NATIVE_CHANNEL_ID,
      name: "Avisos do Agenda Gama",
      description: "Mensagens, diario, comunicados e outros avisos da escola.",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#0B967A"
    });
  }

  async function syncNativePushRegistration() {
    const plugin = getNativePushPlugin();
    if (!plugin) return null;
    if (nativePushRegistrationPromise) return nativePushRegistrationPromise;

    nativePushRegistrationPromise = (async function () {
      await ensureNativePushListeners();

      const permission = await refreshNativeNotificationPermission();
      if (permission !== "granted") return null;

      try {
        await createNativeNotificationChannel();
      } catch (error) {
        console.warn("[Agenda Gama] Nao foi possivel criar o canal nativo de alertas.", error);
      }

      const tokenPromise = new Promise(function (resolve, reject) {
        const timer = window.setTimeout(function () {
          nativeRegistrationWaiter = null;
          if (activeNativePushToken) {
            resolve(activeNativePushToken);
            return;
          }
          reject(new Error("O Firebase nao devolveu o token deste aparelho."));
        }, 15000);

        nativeRegistrationWaiter = {
          resolve: function (token) {
            window.clearTimeout(timer);
            resolve(token);
          },
          reject: function (error) {
            window.clearTimeout(timer);
            reject(error);
          }
        };
      });

      await plugin.register();
      const token = await tokenPromise;
      await syncNativeTokenToServer(token);
      return { token };
    })();

    try {
      return await nativePushRegistrationPromise;
    } finally {
      nativePushRegistrationPromise = null;
    }
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
    const nativePlugin = getNativePushPlugin();
    if (nativePlugin) {
      await ensureNativePushListeners();
      let status = await nativePlugin.checkPermissions();
      if (status?.receive === "prompt" || status?.receive === "prompt-with-rationale") {
        status = await nativePlugin.requestPermissions();
      }
      nativeNotificationPermission = normalizeNativePermission(status?.receive);
      dispatchNotificationPermissionChanged();
      return nativeNotificationPermission;
    }

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
    if (getNativePushPlugin()) {
      return syncNativePushRegistration();
    }

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
    const nativePlugin = getNativePushPlugin();
    if (nativePlugin) {
      await ensureNativePushListeners();
      const token = String(options?.token || activeNativePushToken || window.localStorage.getItem(NATIVE_TOKEN_KEY) || "").trim();
      if (window.AgendaGamaSupabase?.invokeFunction && token) {
        try {
          await window.AgendaGamaSupabase.invokeFunction("remove-native-push-token", { token });
        } catch (error) {
          console.warn("[Agenda Gama] Nao foi possivel remover o aparelho do push nativo.", error);
        }
      }
      if (options?.unsubscribe !== false) {
        await nativePlugin.unregister().catch(function (error) {
          console.warn("[Agenda Gama] Nao foi possivel cancelar o registro nativo.", error);
        });
        activeNativePushToken = "";
        window.localStorage.removeItem(NATIVE_TOKEN_KEY);
      }
      return true;
    }

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
    if (getNativePushPlugin()) {
      await ensureNativePushListeners();
      const permission = await refreshNativeNotificationPermission();
      return permission === "granted" && Boolean(activeNativePushToken || window.localStorage.getItem(NATIVE_TOKEN_KEY));
    }

    const registration = await ensureServiceWorkerRegistration();
    if (!registration?.pushManager) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    activePushEndpoint = String(subscription?.endpoint || activePushEndpoint || "");
    return Boolean(subscription);
  }

  async function showNotification(options) {
    if (getNativePushPlugin()) {
      return true;
    }

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
    if (isNativePlatform()) return false;
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
    isNativePlatform: isNativePlatform,
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
    supportsPushNotifications: supportsPushNotifications,
    normalizeAppHref: normalizeAppHref,
    getNativeAppInfo: getNativeAppInfo,
    openExternalUrl: openExternalUrl
  };

  if (getNativePushPlugin()) {
    void ensureNativePushListeners();
    void refreshNativeNotificationPermission();
  }
  if (getNativeAppPlugin()) {
    void ensureNativeAppLinks();
  }

  window.dispatchEvent(new CustomEvent("agenda-pwa-ready"));
  dispatchNotificationPermissionChanged();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateStandaloneClass, { once: true });
  } else {
    updateStandaloneClass();
  }

  window.addEventListener("load", registerServiceWorker, { once: true });
})();
