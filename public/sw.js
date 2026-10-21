const CACHE_NAME = 'recta-v2';
const urlsToCache = [
  '/',
  '/index.html'
];

// Endpoints sensíveis que NÃO devem ser cacheados
const SENSITIVE_ENDPOINTS = [
  '/app/transactions',
  '/app/accounts',
  '/app/budgets',
  '/app/goals',
  '/app/recurring',
  '/app/credit-cards',
  '/app/reports',
  '/app/settings',
  // Firestore endpoints
  'firestore.googleapis.com',
  'firebaseio.com',
  // Firebase Auth endpoints
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];

// Verificar se a URL contém endpoints sensíveis
const isSensitiveEndpoint = (url) => {
  return SENSITIVE_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// Verificar se é um asset estático (pode ser cacheado com segurança)
const isStaticAsset = (url) => {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url) ||
         url.includes('/assets/') ||
         url.endsWith('/index.html');
};

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((error) => {
          console.log('Cache addAll failed:', error);
        });
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // SEGURANÇA: Não cachear endpoints sensíveis - sempre buscar da rede
  if (isSensitiveEndpoint(request.url)) {
    event.respondWith(
      fetch(request).catch(() => {
        // Se offline e for endpoint sensível, não retornar cache antigo
        // Retornar erro ou página offline genérica
        return new Response('Offline - Conecte-se à internet para ver seus dados', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }

  // Para assets estáticos, usar estratégia Cache First
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          // Return cached version or fetch from network
          return response || fetch(request).then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          });
        })
        .catch(() => {
          // If both cache and network fail, return offline page if available
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Para outras requisições (HTML, etc), usar estratégia Network First
  // Network First garante que dados dinâmicos sempre sejam atualizados
  event.respondWith(
    fetch(request, {
      // Adicionar cache: 'no-store' para garantir que sempre busque da rede primeiro
      cache: 'no-store'
    })
      .then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response para cachear em background
        const responseToCache = response.clone();

        // Atualizar cache em background (não bloqueia a resposta)
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseToCache).catch(() => {
              // Ignorar erros de cache silenciosamente
            });
          })
          .catch(() => {
            // Ignorar erros de cache silenciosamente
          });

        return response;
      })
      .catch(() => {
        // Se a rede falhar, tentar usar cache como fallback
        return caches.match(request).then((response) => {
          // Se cache também falhar, retornar página offline
          return response || caches.match('/index.html');
        });
      })
  );
});

