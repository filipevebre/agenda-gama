(function () {
  const ROOT_SCOPE = "/";

  function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function updateStandaloneClass() {
    document.documentElement.classList.toggle("pwa-standalone", isStandaloneMode());
    document.body?.classList.toggle("pwa-standalone", isStandaloneMode());
  }

  let deferredPrompt = null;

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    try {
      await navigator.serviceWorker.register("/sw.js", { scope: ROOT_SCOPE });
    } catch (error) {
      console.warn("[Agenda Gama] Nao foi possivel registrar o service worker.", error);
    }
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
    promptInstall: promptInstall
  };

  window.dispatchEvent(new CustomEvent("agenda-pwa-ready"));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateStandaloneClass, { once: true });
  } else {
    updateStandaloneClass();
  }

  window.addEventListener("load", registerServiceWorker, { once: true });
})();
