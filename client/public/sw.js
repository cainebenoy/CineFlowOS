const CACHE_NAME = 'cineflow-cache-v2';
const DB_NAME = 'CineFlowSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_mutations';

// IndexedDB Helper in SW
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueueMutation(req) {
  const db = await openDB();
  const mutation = {
    ...req,
    id: crypto.randomUUID(),
    queued_at: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(mutation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPendingMutations() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearMutation(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Bypass all Next.js internal requests (HMR, chunks, etc)
  if (request.url.includes('/_next/')) {
    return;
  }
  
  // Handle API mutations (POST, PUT, DELETE)
  if (request.url.includes('/api/') && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const response = await fetch(request.clone());
          
          // If Go API returns 503 (e.g. Python worker offline) or 502, treat it as offline and enqueue
          if (!response.ok && (response.status === 503 || response.status === 502)) {
            throw new Error('Service Unavailable - Treat as Offline');
          }
          
          return response;
        } catch (error) {
          // If network fails (offline), serialize and enqueue
          const clonedReq = request.clone();
          const headers = {};
          clonedReq.headers.forEach((val, key) => { headers[key] = val; });
          
          let body = '';
          if (clonedReq.headers.get('content-type')?.includes('application/json')) {
             body = await clonedReq.text();
          }

          // Do not queue multipart/form-data for now (script upload) due to blob complexities
          if (clonedReq.headers.get('content-type')?.includes('multipart/form-data')) {
            throw error;
          }

          await enqueueMutation({
            url: clonedReq.url,
            method: clonedReq.method,
            headers: headers,
            body: body
          });

          // Return a mock success response so the UI optimistic updates work
          return new Response(JSON.stringify({ status: "queued", offline: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }

  // Handle standard GET requests (Stale-while-revalidate for static assets ONLY)
  // Never cache HTML page navigations — only cache JS, CSS, images, fonts
  if (request.method === 'GET' && !request.url.includes('/api/') && !request.url.includes('_next/webpack-hmr')) {
    const url = new URL(request.url);
    const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/i.test(url.pathname);
    
    if (isStaticAsset) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => cachedResponse); // fallback to cache if offline
          return cachedResponse || fetchPromise;
        })
      );
    }
    // For HTML page navigations, let the browser handle them normally (no SW interception)
  }
});

// Listen for sync event or custom flush messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FLUSH_QUEUE') {
    event.waitUntil(flushQueue());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  const mutations = await getPendingMutations();
  if (mutations.length === 0) return;

  // Sort by queued_at to preserve order
  mutations.sort((a, b) => a.queued_at - b.queued_at);

  for (const m of mutations) {
    try {
      const response = await fetch(m.url, {
        method: m.method,
        headers: m.headers,
        body: m.body || undefined
      });
      if (response.ok || response.status >= 400) {
        // If it succeeded or failed permanently (e.g., 400), remove from queue
        await clearMutation(m.id);
      }
    } catch (e) {
      console.log('Sync failed, keeping in queue', e);
      break; // stop flushing on first network failure
    }
  }
}
