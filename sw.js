const CACHE_NAME = "agenda-gama-pwa-v2";
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
  "/assets/js/communication.js",
  "/assets/js/comunicados.js",
  "/assets/js/diario.js",
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
  "/app/comunicacao.html",
  "/app/comunicados.html",
  "/app/comunicados-arquivados.html",
  "/app/diario.html",
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
