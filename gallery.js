// ============================================================
//  gallery.js — Galería pública + flujo de compra MercadoPago
// ============================================================

const galleryGrid   = document.getElementById('galleryGrid');
const buyModal      = document.getElementById('buyModal');
const downloadModal = document.getElementById('downloadModal');
const modalClose    = document.getElementById('modalClose');
const btnBuy        = document.getElementById('btnBuy');
const btnDownload   = document.getElementById('btnDownload');

let currentWallpaper = null;

// ── 1. Cargar wallpapers desde Google Sheets vía Apps Script ──
async function loadWallpapers() {
  try {
    const res  = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getWallpapers`);
    const data = await res.json();

    if (!data.wallpapers || data.wallpapers.length === 0) {
      galleryGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:60px 0">No hay wallpapers disponibles aún.</p>';
      return;
    }

    galleryGrid.innerHTML = '';
    data.wallpapers.forEach(w => galleryGrid.appendChild(createCard(w)));

  } catch (err) {
    galleryGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#ff5252;padding:60px 0">Error al cargar. Verificá tu conexión.</p>';
    console.error(err);
  }
}

// ── 2. Crear tarjeta de wallpaper ──
function createCard(wallpaper) {
  const config = typeof wallpaper.json_config === 'string'
    ? JSON.parse(wallpaper.json_config)
    : wallpaper.json_config;

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

  // Parallax en hover (escritorio)
  const stage = card.querySelector('.card-preview-stage');
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

// ── 3. Aplicar parallax a capas ──
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

  // Preview en modal
  const preview = document.getElementById('modalPreview');
  preview.innerHTML = config.layers.map((l, i) => `
    <div class="card-layer"
         style="background-image:url('${l.url}');z-index:${i}"
         data-depth="${l.depth}">
    </div>
  `).join('');

  const layers = preview.querySelectorAll('.card-layer');
  preview.addEventListener('mousemove', e => {
    const rect = preview.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    applyParallax(layers, cx, cy, 18);
  });

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
    // Crear preference en Apps Script (que llama a MP API)
    const res  = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=createPreference`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        wallpaper_id:  currentWallpaper.id,
        nombre_club:   currentWallpaper.nombre_club,
        precio:        currentWallpaper.precio,
        url_apk:       currentWallpaper.url_apk,
        success_url:   `${CONFIG.BASE_URL}/index.html?payment=success&id=${currentWallpaper.id}`,
        failure_url:   `${CONFIG.BASE_URL}/index.html?payment=failure`,
        pending_url:   `${CONFIG.BASE_URL}/index.html?payment=pending`,
      })
    });

    const data = await res.json();

    if (data.init_point) {
      // Redirigir a MercadoPago
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
    // Buscar APK URL del wallpaper
    fetch(`${CONFIG.APPS_SCRIPT_URL}?action=getWallpaper&id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.wallpaper) {
          btnDownload.href = data.wallpaper.url_apk;
          btnDownload.download = `${data.wallpaper.nombre_club.replace(/\s+/g,'_')}_Wallpaper.apk`;
          buyModal.style.display = 'none';
          downloadModal.style.display = 'flex';
          // Limpiar URL
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
