// ============================================================
// SERVICE WORKER — Conectividade Financeira Vanguard
// Estratégia híbrida: Cache First (assets) + Stale While Revalidate (APIs)
// ============================================================

const CACHE_NAME = 'vanguard-v1.0.0';
const STATIC_CACHE = 'vanguard-static-v1';
const API_CACHE = 'vanguard-api-v1';
const IMG_CACHE = 'vanguard-img-v1';

// Arquivos essenciais para funcionar offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon-512.svg',
  '/assets/icon-192.svg',
  '/assets/icon-maskable.svg',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// APIs que terão cache stale-while-revalidate
const API_PATTERNS = [
  'economia.awesomeapi.com.br',
  'brapi.dev',
  'loteriascaixa-api.herokuapp.com',
  'api.groq.com',
  'generativelanguage.googleapis.com'
];

// ============ INSTALAÇÃO ============
self.addEventListener('install', event => {
  console.log('[SW] Instalando...', CACHE_NAME);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cacheando assets estáticos');
        // allSettled para não falhar se um recurso não existir
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url))
        );
      })
      .then(() => self.skipWaiting()) // ativa imediatamente
  );
});

// ============ ATIVAÇÃO — limpa caches antigos ============
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE && k !== IMG_CACHE)
          .map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) // assume controle imediato
  );
});

// ============ FETCH — estratégia híbrida ============
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora métodos não-GET
  if (request.method !== 'GET') return;

  // Ignora requisições de extensões do browser
  if (url.protocol === 'chrome-extension:') return;

  // ============ API → Stale While Revalidate ============
  if (isApiRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // ============ Imagens → Cache First com fallback ============
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  // ============ Assets estáticos → Cache First ============
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ============ Páginas HTML → Network First com fallback offline ============
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // ============ Demais → Network First ============
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ============ ESTRATÉGIAS ============

// Cache First: tenta cache, se falhar vai na rede e cacheia
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache HIT:', request.url);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Falha rede e cache:', request.url);
    return offlineFallback(request);
  }
}

// Network First: tenta rede, se falhar usa cache
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Rede falhou, usando cache:', request.url);
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

// Stale While Revalidate: retorna cache imediatamente, atualiza em background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Busca atualização em background (não bloqueia resposta)
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        // Cacheia com timestamp para expiração
        const timestamped = new Response(
          networkResponse.clone().body,
          {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: networkResponse.headers
          }
        );
        // Adiciona header customizado com timestamp
        const headers = new Headers(networkResponse.headers);
        headers.set('sw-cached-at', Date.now().toString());
        
        cache.put(request, new Response(networkResponse.body, { headers }));
        console.log('[SW] API atualizada em background:', request.url);
      }
      return networkResponse;
    })
    .catch(err => {
      console.warn('[SW] Falha ao atualizar API:', request.url);
    });

  // Retorna cache imediatamente (ou aguarda rede se não houver cache)
  if (cached) {
    // Verifica se cache não está muito velho (> 5 min para APIs financeiras)
    const cachedAt = cached.headers.get('sw-cached-at');
    const age = cachedAt ? Date.now() - parseInt(cachedAt) : Infinity;
    
    if (age < 5 * 60 * 1000) { // 5 minutos
      console.log('[SW] API do cache (recente):', request.url);
      return cached;
    }
    console.log('[SW] API do cache (antiga, atualizando):', request.url);
    // Mesmo antiga, retorna cache — a atualização já está rodando em background
    return cached;
  }

  // Se não tem cache, aguarda a rede
  return fetchPromise;
}

// ============ HELPERS ============

function isApiRequest(url) {
  return API_PATTERNS.some(pattern => url.hostname.includes(pattern));
}

function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.pathname === asset || url.href === asset);
}

function offlineFallback(request) {
  // Página offline customizada
  if (request.destination === 'document') {
    return new Response(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Offline — Vanguard</title>
        <style>
          body{margin:0;background:#0a0e17;color:#e8eef5;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}
          .box{max-width:400px}
          h1{color:#d4af37;font-size:32px;margin-bottom:10px}
          p{color:#8b95a7;line-height:1.6}
          button{margin-top:20px;background:#d4af37;color:#1a1400;border:none;padding:12px 24px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px}
        </style>
      </head>
      <body>
        <div class="box">
          <h1>📡 Offline</h1>
          <p>Você está sem conexão. Alguns dados em cache ainda estão disponíveis, mas cotações em tempo real precisam de internet.</p>
          <button onclick="location.reload()">Tentar novamente</button>
        </div>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' }});
  }
  return new Response('', { status: 408 });
}

// ============ LIMPEZA PERIÓDICA DE CACHE ============
// Remove entradas de API com mais de 1 hora
setInterval(async () => {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();
  const now = Date.now();
  for (const req of keys) {
    const res = await cache.match(req);
    const cachedAt = res.headers.get('sw-cached-at');
    if (cachedAt && now - parseInt(cachedAt) > 60 * 60 * 1000) {
      await cache.delete(req);
    }
  }
}, 30 * 60 * 1000); // roda a cada 30 min

// ============ MENSAGENS DO CLIENTE ============
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
  if (event.data?.type === 'GET_CACHE_INFO') {
    getCacheInfo().then(info => {
      event.source.postMessage({ type: 'CACHE_INFO', data: info });
    });
  }
});

async function getCacheInfo() {
  const info = {};
  for (const name of [STATIC_CACHE, API_CACHE, IMG_CACHE]) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    info[name] = keys.length;
  }
  return info;
}

console.log('[SW] Service Worker carregado —', CACHE_NAME);
