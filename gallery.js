// ============================================================
//  gallery.js — Galería pública + flujo de compra MercadoPago
//  VERSIÓN CORREGIDA: Todo GET para evitar CORS
// ============================================================

const galleryGrid   = document.getElementById('galleryGrid');
const buyModal      = document.getElementById('buyModal');
const downloadModal = document.getElementById('downloadModal');
const modalClose    = document.getElementById('modalClose');
const btnBuy        = document.getElementById('btnBuy');
const btnDownload   = document.getElementById('btnDownload');

let currentWallpaper = null;
let modalParallaxBound = false;

function getBaseUrl() {
  return (CONFIG.BASE_URL || '').replace(/\/+$/, '');
}

function getErrorMessage(error) {
  if (!error) return 'Error desconocido.';
  if (typeof error === 'string') return error;
  return error.message || String(error);
}

function showGalleryError(message, details = '') {
  const fullMessage = details ? `${message}\n${details}` : message;
  console.error('[Gallery] Error visible para usuario:', fullMessage);

  galleryGrid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;color:#ff5252;padding:40px 20px;line-height:1.5">
      <p style="font-weight:700;margin-bottom:8px">No se pudo cargar la galería.</p>
      <p style="margin:0">${message}</p>
      ${details ? `<p style="margin-top:10px;color:#ffb3b3;word-break:break-word"><small>${details}</small></p>` : ''}
    </div>
  `;
}

// ── 1. Cargar wallpapers desde Google Sheets ──
async function loadWallpapers() {
  try {
    if (typeof CONFIG === 'undefined') {
      throw new Error('CONFIG no está definido. Verificá que config.js cargue antes que gallery.js.');
    }

    console.log('[Gallery] CONFIG cargado:', CONFIG);

    if (!CONFIG.APPS_SCRIPT_URL || typeof CONFIG.APPS_SCRIPT_URL !== 'string') {
      throw new Error('CONFIG.APPS_SCRIPT_URL no está definido o no es válido.');
    }

    const endpoint = `${CONFIG.APPS_SCRIPT_URL}?action=getWallpapers&t=${Date.now()}`;
    console.log('[Gallery] URL llamada:', endpoint);

    const res = await fetch(endpoint, { cache: 'no-store' });

    if (!res.ok) {
      throw new Error(`Apps Script respondió HTTP ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(`Apps Script no devolvió JSON válido. Respuesta: ${rawText.slice(0, 300)}`);
    }

    console.log('[Gallery] Respuesta recibida:', data);

    if (!data || !Array.isArray(data.wallpapers)) {
      throw new Error('La respuesta no contiene data.wallpapers como array.');
    }

    if (data.wallpapers.length === 0) {
      galleryGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:60px 0">No hay wallpapers disponibles aún.</p>';
      return;
    }

    const validWallpapers = [];
    const parseErrors = [];

    data.wallpapers.forEach((wallpaper, index) => {
      try {
        const parsedConfig = parseWallpaperConfig(wallpaper);
        validWallpapers.push({ ...wallpaper, _parsedConfig: parsedConfig });
      } catch (error) {
        const reason = getErrorMessage(error);
        parseErrors.push(`Item #${index + 1} (${wallpaper?.nombre_club || 'sin nombre'}): ${reason}`);
      }
    });

    if (parseErrors.length > 0) {
      console.error('[Gallery] Errores al parsear json_config:', parseErrors);
    }

    if (validWallpapers.length === 0) {
      throw new Error(`No se pudo renderizar ningún wallpaper. ${parseErrors[0] || 'Todos tienen json_config inválido.'}`);
    }

    galleryGrid.innerHTML = '';
    validWallpapers.forEach(w => galleryGrid.appendChild(createCard(w)));

  } catch (err) {
    const exactError = getErrorMessage(err);
    console.error('[Gallery] Error exacto en loadWallpapers:', err);
    showGalleryError('Error al cargar wallpapers.', exactError);
  }
}

function parseWallpaperConfig(wallpaper) {
  const { json_config: jsonConfig } = wallpaper || {};
  const config = typeof jsonConfig === 'string' ? JSON.parse(jsonConfig) : jsonConfig;

  if (!config || !Array.isArray(config.layers)) {
    throw new Error('json_config inválido: falta layers[]');
  }

  return config;
}

// ── 2. Crear tarjeta de wallpaper ──
function createCard(wallpaper) {
  const config = wallpaper._parsedConfig || parseWallpaperConfig(wallpaper);

  const card = document.createElement('div');
  card.className = 'wallpaper-card';
  card.innerHTML = `
    <div class="card-preview">
      <div class="card-preview-stage" id="stage-${wallpaper.id}">
        ${config.layers.map((l, i) => `
          <div class="card-layer"
               style="background-image:url('${l.url}');z-index:${i}"
               data-depth="${l.depth}">
          </div>
        `).join('')}
      </div>
    </div>
    <div class="card-info">
      <div class="card-club-name">${wallpaper.nombre_club}</div>
      <div class="card-meta">
        <span class="card-price">USD $${parseFloat(wallpaper.precio).toFixed(2)}</span>
        <button class="card-btn">COMPRAR</button>
      </div>
    </div>
  `;

  // Parallax en hover
  const stage  = card.querySelector('.card-preview-stage');
  const layers = stage.querySelectorAll('.card-layer');

  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    applyParallax(layers, cx, cy, 12);
  });

  card.addEventListener('mouseleave', () => {
    layers.forEach(l => l.style.transform = 'translate3d(0,0,0)');
  });

  card.querySelector('.card-btn').addEventListener('click', e => {
    e.stopPropagation();
    openBuyModal(wallpaper, config);
  });

  card.addEventListener('click', () => openBuyModal(wallpaper, config));

  return card;
}

// ── 3. Aplicar parallax ──
function applyParallax(layers, cx, cy, maxPx) {
  layers.forEach(layer => {
    const depth = parseFloat(layer.dataset.depth) / 100;
    const tx = cx * maxPx * depth;
    const ty = cy * maxPx * depth;
    layer.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  });
}

// ── 4. Modal de compra ──
function openBuyModal(wallpaper, config) {
  currentWallpaper = wallpaper;

  document.getElementById('modalClubName').textContent = wallpaper.nombre_club;
  document.getElementById('modalPrice').textContent    = `$${parseFloat(wallpaper.precio).toFixed(2)}`;

  const preview = document.getElementById('modalPreview');
  preview.innerHTML = config.layers.map((l, i) => `
    <div class="card-layer"
         style="background-image:url('${l.url}');z-index:${i}"
         data-depth="${l.depth}">
    </div>
  `).join('');

  if (!modalParallaxBound) {
    preview.addEventListener('mousemove', e => {
      const rect = preview.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width  - 0.5;
      const cy = (e.clientY - rect.top)  / rect.height - 0.5;
      applyParallax(preview.querySelectorAll('.card-layer'), cx, cy, 18);
    });

    preview.addEventListener('mouseleave', () => {
      preview.querySelectorAll('.card-layer').forEach(l => {
        l.style.transform = 'translate3d(0,0,0)';
      });
    });

    modalParallaxBound = true;
  }

  buyModal.style.display = 'flex';
}

// ── 5. Cerrar modal ──
modalClose.addEventListener('click', () => { buyModal.style.display = 'none'; });
buyModal.addEventListener('click', e => { if (e.target === buyModal) buyModal.style.display = 'none'; });

// ── 6. Iniciar pago MercadoPago ──
btnBuy.addEventListener('click', async () => {
  if (!currentWallpaper) return;

  btnBuy.textContent = 'Generando pago...';
  btnBuy.disabled    = true;

  try {
    const params = new URLSearchParams({
      action:       'createPreference',
      wallpaper_id: currentWallpaper.id,
      nombre_club:  currentWallpaper.nombre_club,
      precio:       currentWallpaper.precio,
      url_apk:      currentWallpaper.url_apk,
      success_url:  `${getBaseUrl()}/index.html?payment=success&id=${currentWallpaper.id}`,
      failure_url:  `${getBaseUrl()}/index.html?payment=failure`,
      pending_url:  `${getBaseUrl()}/index.html?payment=pending`,
    });

    const res  = await fetch(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      throw new Error(data.error || 'Sin init_point');
    }

  } catch (err) {
    alert('Error al crear el pago. Intentá de nuevo.\n' + err.message);
    btnBuy.textContent = 'Comprar con MercadoPago';
    btnBuy.disabled    = false;
  }
});

// ── 7. Retorno desde MercadoPago ──
function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('payment');
  const id     = params.get('id');

  if (status === 'success' && id) {
    fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getWallpaper&id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.wallpaper) {
          btnDownload.href     = data.wallpaper.url_apk;
          btnDownload.download = `${data.wallpaper.nombre_club.replace(/\s+/g,'_')}_Wallpaper.apk`;
          buyModal.style.display      = 'none';
          downloadModal.style.display = 'flex';
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(console.error);

  } else if (status === 'failure') {
    alert('El pago no fue procesado. Podés intentar de nuevo.');
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// ── Init ──
loadWallpapers();
handlePaymentReturn();
