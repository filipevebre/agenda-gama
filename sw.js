const CACHE_NAME = "agenda-gama-pwa-v29";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/css/styles.css",
  "/assets/js/pwa.js",
  "/assets/js/config.js",
  "/assets/js/supabase.js",
  "/assets/js/auth.js",
  "/assets/js/app.js",
  "/assets/js/data-store.js",
  "/assets/js/dashboard.js",
  "/assets/js/student-profile.js",
  "/assets/js/communication.js",
  "/assets/js/comunicados.js",
  "/assets/js/diario.js",
  "/assets/js/school-forms.js",
  "/assets/js/school-activities.js",
  "/assets/js/school-menu.js",
  "/assets/js/forms.js",
  "/assets/js/equipe.js",
  "/assets/js/professores.js",
  "/assets/js/responsaveis.js",
  "/assets/js/turmas.js",
  "/assets/images/logo-gama.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png",
  "/app/dashboard.html",
  "/app/perfil-aluno.html",
  "/app/comunicacao.html",
  "/app/comunicados.html",
  "/app/comunicados-arquivados.html",
  "/app/diario.html",
  "/app/atividades.html",
  "/app/cardapio.html",
  "/app/formularios.html",
  "/app/criar-senha.html",
  "/app/organizacao/turmas.html",
  "/app/organizacao/disciplinas.html",
  "/app/organizacao/equipe.html",
  "/app/organizacao/professores.html",
  "/app/organizacao/alunos.html",
  "/app/organizacao/responsaveis.html",
  "/app/organizacao/cadastro-turmas.html",
  "/app/organizacao/cadastro-disciplinas.html",
  "/app/organizacao/cadastro-equipe.html",
  "/app/organizacao/cadastro-professores.html",
  "/app/organizacao/cadastro-alunos.html",
  "/app/organizacao/cadastro-responsaveis.html"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    return cache.match("/index.html", { ignoreSearch: true });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request).then(function (response) {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(function () {
    return null;
  });

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  return networkResponse || Response.error();
}

function normalizePushPayload(payload) {
  return {
    title: String(payload?.title || "Agenda Gama"),
    body: String(payload?.body || ""),
    href: new URL(String(payload?.href || "/app/dashboard.html"), self.location.origin).toString(),
    tag: String(payload?.tag || payload?.id || `agenda-gama-${Date.now()}`),
    kind: String(payload?.kind || ""),
    id: String(payload?.id || "")
  };
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener("push", function (event) {
  event.waitUntil((async function () {
    let payload = normalizePushPayload({});

    try {
      const rawPayload = event.data ? await event.data.text() : "";
      payload = normalizePushPayload(rawPayload ? JSON.parse(rawPayload) : {});
    } catch (error) {
      payload = normalizePushPayload({ body: "Abra o Agenda Gama para ver a nova atualizacao." });
    }

    // Display first so an unavailable window client cannot suppress background push.
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      lang: "pt-BR",
      badge: "/assets/icons/icon-192.png",
      icon: "/assets/icons/icon-192.png",
      renotify: true,
      silent: false,
      timestamp: Date.now(),
      data: payload
    });

    try {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windowClients.forEach(function (client) {
        client.postMessage({
          type: "agenda-push-received",
          payload: payload
        });
      });
    } catch (error) {
      // The system notification is already visible; foreground sync is optional.
    }
  })());
});

self.addEventListener("notificationclick", function (event) {
  const targetHref = new URL(String(event.notification?.data?.href || "/app/dashboard.html"), self.location.origin).toString();
  event.notification?.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      const matchedClient = windowClients.find(function (client) {
        return client.url === targetHref || client.url.startsWith(targetHref);
      }) || windowClients[0] || null;

      if (matchedClient) {
        if ("focus" in matchedClient) {
          matchedClient.focus();
        }
        if ("navigate" in matchedClient && matchedClient.url !== targetHref) {
          return matchedClient.navigate(targetHref).then(function () {
            return matchedClient.focus();
          });
        }
        return matchedClient;
      }

      if (clients.openWindow) {
        return clients.openWindow(targetHref);
      }

      return null;
    })
  );
});
