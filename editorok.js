// ============================================================
//  editor.js — VERSIÓN FINAL CON JSONP 
// ============================================================

const state = { layers: [], dragSrc: null };

const loginOverlay   = document.getElementById('loginOverlay');
const loginPass      = document.getElementById('loginPass');
const loginBtn       = document.getElementById('loginBtn');
const loginError     = document.getElementById('loginError');
const editorApp      = document.getElementById('editorApp');
const layerInput     = document.getElementById('layerInput');
const layersList     = document.getElementById('layersList');
const parallaxStage  = document.getElementById('parallaxStage');
const clubNameInput  = document.getElementById('clubName');
const clubPriceInput = document.getElementById('clubPrice');
const apkUrlInput    = document.getElementById('apkUrl');
const btnSave        = document.getElementById('btnSave');
const btnExport      = document.getElementById('btnExport');
const saveStatus     = document.getElementById('saveStatus');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill   = document.getElementById('progressFill');
const progressText   = document.getElementById('progressText');

// ── LOGIN ──
loginBtn.addEventListener('click', doLogin);
loginPass.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  if (loginPass.value === CONFIG.EDITOR_PASSWORD) {
    loginOverlay.style.display = 'none';
    editorApp.style.display    = 'flex';
    initMouseParallax();
  } else {
    loginError.style.display = 'block';
    loginPass.value = '';
    loginPass.focus();
  }
}

// ── JSONP ──
function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    const script = document.createElement('script');
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Timeout')); }, 15000);
    function cleanup() { clearTimeout(timeout); delete window[cbName]; if (script.parentNode) document.body.removeChild(script); }
    window[cbName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('Error al cargar Apps Script')); };
    script.src = url + '&callback=' + cbName;
    document.body.appendChild(script);
  });
}

// ── UPLOAD A CLOUDINARY ──
layerInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  uploadProgress.style.display = 'block';
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    progressText.textContent = `Subiendo ${i + 1}/${files.length}: ${file.name}`;
    progressFill.style.width = `${(i / files.length) * 100}%`;
    try {
      const url = await uploadToCloudinary(file);
      state.layers.push({ id: `layer_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, name: file.name, url, depth: 50 });
      renderLayers(); renderParallaxPreview();
    } catch (err) { alert(`Error al subir ${file.name}: ${err.message}`); }
  }
  progressFill.style.width = '100%';
  progressText.textContent = '✅ Listo';
  setTimeout(() => { uploadProgress.style.display = 'none'; }, 1500);
  layerInput.value = '';
});

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'wallpapers');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

// ── RENDER CAPAS ──
function renderLayers() {
  if (state.layers.length === 0) { layersList.innerHTML = '<p class="empty-layers">No hay capas aún. Subí PNGs arriba.</p>'; return; }
  layersList.innerHTML = '';
  state.layers.forEach((layer, idx) => {
    const item = document.createElement('div');
    item.className = 'layer-item'; item.draggable = true; item.dataset.index = idx;
    item.innerHTML = `
      <div class="layer-item-top">
        <img class="layer-thumb" src="${layer.url}" alt="${layer.name}" />
        <span class="layer-name" title="${layer.name}">${layer.name}</span>
        <button class="layer-remove" data-index="${idx}">✕</button>
      </div>
      <div class="layer-depth-row">
        <span class="layer-depth-label">Profundidad</span>
        <input type="range" class="depth-slider" min="0" max="100" value="${layer.depth}" data-index="${idx}" />
        <span class="depth-value">${layer.depth}</span>
      </div>`;
    item.querySelector('.depth-slider').addEventListener('input', e => {
      const i = parseInt(e.target.dataset.index), val = parseInt(e.target.value);
      state.layers[i].depth = val; item.querySelector('.depth-value').textContent = val; renderParallaxPreview();
    });
    item.querySelector('.layer-remove').addEventListener('click', e => {
      e.stopPropagation(); state.layers.splice(parseInt(e.target.dataset.index), 1); renderLayers(); renderParallaxPreview();
    });
    item.addEventListener('dragstart', e => { state.dragSrc = idx; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => item.classList.add('dragging'), 0); });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); });
    item.addEventListener('drop', e => {
      e.preventDefault(); const targetIdx = parseInt(item.dataset.index);
      if (state.dragSrc === null || state.dragSrc === targetIdx) return;
      const moved = state.layers.splice(state.dragSrc, 1)[0]; state.layers.splice(targetIdx, 0, moved);
      state.dragSrc = null; renderLayers(); renderParallaxPreview();
    });
    layersList.appendChild(item);
  });
}

// ── RENDER PREVIEW ──
function renderParallaxPreview() {
  if (state.layers.length === 0) { parallaxStage.innerHTML = '<p class="preview-placeholder">Subí capas PNG para ver el preview</p>'; return; }
  parallaxStage.innerHTML = state.layers.map((layer, i) => `
    <div class="parallax-layer" style="background-image:url('${layer.url}');z-index:${i}" data-depth="${layer.depth}"></div>
  `).join('');
}

// ── PARALLAX CON MOUSE ──
function initMouseParallax() {
  const phoneScreen = document.getElementById('phoneScreen');
  phoneScreen.addEventListener('mousemove', e => {
    const rect = phoneScreen.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    parallaxStage.querySelectorAll('.parallax-layer').forEach(layer => {
      const depth = parseFloat(layer.dataset.depth) / 100;
      layer.style.transform = `translate3d(${cx * 20 * depth}px, ${cy * 20 * depth}px, 0)`;
    });
  });
  phoneScreen.addEventListener('mouseleave', () => {
    parallaxStage.querySelectorAll('.parallax-layer').forEach(l => { l.style.transform = 'translate3d(0,0,0)'; });
  });
}

// ── TOGGLE VISTA ──
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('previewContainer').classList.toggle('full-view', btn.dataset.view === 'full');
  });
});

// ── GUARDAR EN SHEETS ──
btnSave.addEventListener('click', async () => {
  const clubName = clubNameInput.value.trim();
  if (!clubName) { alert('Ingresá el nombre del club'); return; }
  if (state.layers.length === 0) { alert('Agregá al menos una capa'); return; }
  const layersForSheets = state.layers.map((layer, index) => ({ index, url: typeof layer.url === 'string' ? layer.url.trim() : '', depth: Number.isFinite(layer.depth) ? layer.depth : 50 }));
  const firstInvalidLayer = layersForSheets.find(layer => !layer.url);
  if (firstInvalidLayer) { const msg = `Falta URL en la capa ${firstInvalidLayer.index + 1}.`; saveStatus.textContent = `❌ ${msg}`; alert(msg); return; }
  const jsonConfigString = JSON.stringify({ layers: layersForSheets.map(l => ({ url: l.url, depth: l.depth })) });
  btnSave.disabled = true; saveStatus.textContent = '💾 Guardando...';
  try {
    const params = new URLSearchParams({ action: 'saveWallpaper', nombre_club: clubName, precio: parseFloat(clubPriceInput.value) || 2.99, url_apk: apkUrlInput.value.trim(), json_config: jsonConfigString });
    const data = await fetchJsonp(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);
    if (data.success) { saveStatus.textContent = `✅ Guardado con ID: ${data.id}`; } else { throw new Error(data.error || 'Error desconocido'); }
  } catch (err) { saveStatus.textContent = `❌ Error: ${err.message}`; } finally { btnSave.disabled = false; setTimeout(() => { saveStatus.textContent = ''; }, 5000); }
});

// ── EXPORTAR ZIP ──
btnExport.addEventListener('click', async () => {
  const clubName = clubNameInput.value.trim();
  if (!clubName) { alert('Ingresá el nombre del club'); return; }
  if (state.layers.length === 0) { alert('Agregá al menos una capa'); return; }
  btnExport.textContent = '⏳ Generando ZIP...'; btnExport.disabled = true;
  try {
    const zip = new JSZip();
    const config = buildConfig();
    const slug = clubName.replace(/\s+/g, '_').toLowerCase();
    const pkg = 'com.wallpaper.' + slug.replace(/[^a-z0-9]/g, '');
    const root = zip.folder('LiveWallpaper_' + clubName.replace(/\s+/g, ''));
    root.file('app/src/main/assets/config.json', JSON.stringify(config, null, 2));
    const kp = `app/src/main/kotlin/${pkg.replace(/\./g, '/')}/`;
    root.file(kp + 'MainActivity.kt',     buildMainActivity(pkg, clubName));
    root.file(kp + 'WallpaperService.kt', buildWallpaperService(pkg));
    root.file(kp + 'ParallaxRenderer.kt', buildParallaxRenderer(pkg));
    root.file('app/src/main/res/values/strings.xml',      buildStringsXml(clubName));
    root.file('app/src/main/res/values/colors.xml',       buildColorsXml());
    root.file('app/src/main/res/values/themes.xml',       buildThemesXml());
    root.file('app/src/main/res/xml/wallpaper_info.xml',  buildWallpaperInfoXml());
    root.file('app/src/main/res/drawable/bg_gradient.xml',buildGradientXml());
    root.file('app/src/main/res/layout/activity_main.xml',buildLayoutXml());
    root.file('app/src/main/AndroidManifest.xml',         buildManifest(pkg));
    root.file('app/build.gradle',                         buildAppGradle(pkg));
    root.file('app/proguard-rules.pro',                   '');
    root.file('build.gradle',                             buildRootGradle());
    root.file('settings.gradle',                          buildSettingsGradle(slug));
    root.file('gradle.properties',                        buildGradleProperties());
    root.file('.gitignore', '*.iml\n.gradle\n/local.properties\n/.idea\n/build\n/captures\n.externalNativeBuild\n.cxx\n');
    root.file('gradlew',                                  buildGradlewSh());
    root.file('gradlew.bat',                              buildGradlewBat());
    root.file('gradle/wrapper/gradle-wrapper.properties', buildGradleWrapper());
    root.file('README.md',                                buildAndroidReadme(clubName));

    // ── ÍCONOS CLUB WALLS ──
    const _iMdpi    = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAC60lEQVR4nO2ZbW+jMBCEn/ULkP//X5MAtvc+gDnDJZSGplwkRkKQgGBmd3YcWlFV5YNhjiawF6eAo3EKOBofL8CtnRSR3+KxirWk//gOnAKOxingaLxVwG+k2GqMvgpfVzR1g7UGTYqqEmMkpURMiZQiKSZUdTUit+DHBIgIVVXRXBqc88N3ALa8CBj5pjQISGkUFtO4j9P5fPxWASJCXdc0TYNzDhUgKcu66uJAjGAwWGtBFBBkkEzXdVyv1/cKMMbQNA1VXeOsRWG0xFj5otrkz+UeUHQkbQCl6zputxtd123m8W0B1tqBeFVhrR1sMDIVGYqp476ELMQoYMQgQN/33G432rb9Lp1tAkQE59xEXERQgZR0KOhIbjDCeFyI0IUwkcEuYQfxidvaO3GOQWMMVVVhjJltIoIYAwIGmdkmi5nd3ggGoe97rtfrZqusJdUmAc/OlQIfbdba6ToRmazSdR3ee5xzpJRm2yM6bxGQkbsDZTSm2YPzfVJKeO+5XC44/zdqlXE9GJnkDuUUWhPwcgpZa6nrepqJJbKQvFhl8n4knrTwmhkKkWKibVvu9/umCIUXOuCco65rvPfDMH+xkpZWwwgUlc7nYozc73fatp26V2J3B0QE7z11XeOcQ0RmflUGG5gxg1R1Ij17uP5NIYAY41TxV39SbBKQEyeEQIwREZkGdVDIRD4LfgRBEIEQwlTxvdg1xGXCZJFlxM7itrBKCAHnHN57YozTjJRdLa301hSy1s5SqBzc0krZdnlBtNY+vJ+q/mOrt6ZQnolHRJabc24iXpLKYdD3PW3bEkLYzOPbHcgVd85hjJkRKSu+vM+jxFoSfxaduy0kIhPxZ61fQymqTKe+7+m67svM320hY8zwW398syqH96sH5yrn61NKhBA2Ed+Cl4a4FPAsiZbXlcQfLVZr+PEh3vIuuxSV34l/Grtj9Ddw/m30f8Yp4Gh8vIDVGP2E/4F/fAdOAUfjFHA0Pl7AH/uIGxlHgPA0AAAAAElFTkSuQmCC';
    const _iHdpi    = 'iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAEvklEQVR4nO2a4ZKqMAyFT9IC7vu/6xUQmvujphYEgquoO9Mzw7jLhVK+m6QndUlEBEWr4k9P4NtVABkqgAwVQIYKIEMFkKECyFABZKgAMuT3XkhER87j7drbQJQIMlQAGSqADBVAhgogQwWQoQLIUAFkqAAytNtJHykignMOABBCgIjsdrpH66OAiAl1XaNpTvDegUAJjohgHEeEEBBCmPz8ToC091uNV/ZizIy6qdGcTilyCACymSw9T6eqoHJw+ikiCCGYc9gL+K2AnHNomgZ108B5B5J9ExWaAiToCVUEIkIJkELTaBuGAZfL5TbmTkBvSTHnHE6nE+q6hmMHoWuKPJolBEAAwcq9BDAxiAhVVYGIEELA+XzeFVVLOhRQVVUxYuoazHyrL8AkAoQAWnhhya8BACL9CTwJIYJcwREipHEc0bYt2rb9NRzgoBSLhbdBXdUATV8UuKWLnl+CY0mYQCIx3XRcZoQMzDiO6/e/O8WIKIHxVZWmvTQNkVsAPVrZiOianpLu1lRq//3D+XzeBPOongakYE7XFYmIIBTBkNjRoul2dz47lxfpgDgog25grhEzDMOzr3OnXwNyzt0ixvupN8leVkRi7QjxU/8prUp0u2UrmkQAplvEyBXMqyNmrqcAERGGYcA4jmBmMMfOhYii6YOAmRFIQCG+nBAAkZhmRClT5nDmEUV0rYMiaM/nw8Hc5vGiIk0UQ56Z02d+5OfWxkr1ZeV813UvA/OVRhHABJJzbhGkwgSia+66brIq1XV04YSpq84Pqx35KkDee3jvJ63AWkswj0RtIQCgaRqcTqdY84gWtyLyXk6fMQzDnR/6CiddVRXquk6uVqWTm8NaigIiws/PT1oMACCIQBAgucGim31QuJqWXdf92iweEkFzMFuP2Bo3hDAp/ipBXBGXrAGDUlputRhvTzHtf+q6hvfeBPPQ8ziuinEBlDS2XqOfYxjRtTFirEL+thRjZnjv78AsTSD2Sr+rZTmQfGytU23bPpVKa3rKB2nE6J7O6sohiB08AQiyWI82l37gWmOm147j+HSNsfQrQMyMqqrgnJsUUz0ATP6340sKKGCSHlaYp2sxS6UsYo7eWXxJDcrhLJlCYgITT8bZU9NUHG10Wq67rtsz5U19lQ/S+/NDW5W5084BagRpQ6pgdJ+Jme9sQf47sA7iqwA555JRzF3u/NF5FOoxjmPaKtXmWOEuKfdYWsC7rkPf94vXWToUkBbyqqqSl8lfAMBiezA3ihoxaTvFmLLuXmpKDsNwd89HAelWiPc+TfaRsecQdZWcK1/6dZw5mDV9BJCCcc7BOff0CjN/pjWHy+WCrut2bZy9FVAOJo+Yre+2lqJmywutnddmtO/7h3YU3wLIe5/8UF4bXrE1shY9ClK/93oUjOrQVoOZJ62FKm8z1qJn3kdtRc7SvQDQ9z36vv/eHcW5a8477nzTa9VV7wQ1v1ZT6c/vKM7hzJ12DnF+z9JyrF8bvzJiPrphZm13Avfg5m0KgGQSj2pE9+hjf/6yB+I3qPyFmaECyFABZKgAMlQAGSqADBVAhgogQwWQod1O+i+43iNUIshQAWSoADJUABkqgAwVQIYKIEMFkKECyNB/ZSzcI6p7dPsAAAAASUVORK5CYII=';
    const _iXhdpi   = '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';
    const _iXxhdpi  = 'iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAALHElEQVR4nO2d67ayOgxFUy76vf/THrdAzw9dEGKBQkRR1xxjD2/clEmaptUdYoxRCNlI8e4DIJ8NBSIuKBBxQYGICwpEXFAg4oICERcUiLigQMQFBSIuKBBxQYGICwpEXFAg4oICERcUiLigQMQFBSIuKBBxQYGIi2qPjYYQ9tgscbLH9ycYgYgLCkRcUCDiggIRFxSIuKBAxAUFIi4oEHFBgYgLCkRcUCDiggIRFxSIuKBAxAUFIi4oEHFBgYgLCkRcUCDiYpc50Z+Mnc/N32GfhwLdKYpC6rqWuq57iWKM0nXd6BZ/eIzlfpXfFiiIlGUlVVVJfaqlrioJoRDEIBuNuq4TEeklappGRETatu2lEpH++a7rJITw1YKFPf5Xxid8racoSzmdT3I6naQoi0GcKDJ39HPvLcYobduKyE0eHbWappEQwkgurPMq9tjXTwkUQpCyLKWuazmdz1JWpYgMHyyOO6z8RGKMUhRFf7/fjvocIIyWqm3bXjQRGUU0fVzPggJtBOL0Eae4RRyReP9Qg4QgEqNICCKy4ROJkreuzq+Gx9FEr+ExmkYt3tboRYFWEkLoE+O6rqWsSol3U9ZGmSWiestz29YRSj0rIng+3OUen3DcR9Rq21ZCCHK9XiWEMIpwEC+172fzlQLpHlVd10PzknmStxCD9AlzzrbHyfUg0O2p8LCcbha7rpOiKEZRrOs6uVwu0jSN/P399UKNjnEHgb6qFwZxTqeTVFX1kJdsbJ2WSV0vMzt7vMDmE3Pc6kiDvKvrOvn7+5PL5TIpzp58RQRCYlzX9Ugcy1wEWhudRssnuurJ52L6NZsXLUUzvHa9Xntxck4jI5BC96ggzqK4t3x5vB0JEjfEJR1gsvMNZOqSvsj658LwOJjXIc5///2XLc6efJxAIQSpqmrUTE1FnPGKcj95x0jw1wBx3tlUTfExTVhRFFJVVS9PWZajnECK5X3q5iDaSLTiU9haXY4qskiMt6LlxGeF57uuk6Zp5HK5yPV67bv6W/jJJgziQBodcWKMt3gSQt+cQKolifsm6H5nTYK95kTY/GY47lvtaWodVK/RVOFCOdrQyGEF6ivG98JfWY6rxmDvRiklwN770smxjThHkkfkYE0YEmNEHB1tQgh9E9BfwY8bkCAinYolIYpEiQ9L2yZstJmJT2TU87pvMUYMng3JeKqpDCFMbldHHOQ5nqZqiq9uwnTEQVOVrtrOEOPQLOGphDxPIaq+WxSJa5Ko+5hJTsQ5Om8VaDS42Y9RmZqIkUgXBVNJi30qJQ/Gv5JePeki7d+HqPcx9M9FREY5zqeJA94iELriqN+gRzVFX7JHwxHNa0H6kzIU3+5NTBht6J68oi3ETezXT2XTvbQb5Brq38N+v0Ec8HKBiqKQf//+9TWcoEK5iDxEmyWGK12hfNgVVRicXESkHxz95KZqipcn0Wi2tDhVVUmMUarq5jN6XMiDRom07Q5DoKAilX5Huj5kai92/f4Yt0znUAEMTdXRcpyvHo23UQjSQDbdI6uqSrquG4smjylNjFFCAVlEbtnusA87HhWHNm1bT/K+SnHQiPPVAuVsExEDIqEJ7G9DIaEIfXSzTaS+j8lZdvue96BznD2741v5aYHW7lvLoyOYflyW5UMTuaZwqKVGHWduyAE9zrIopWnHc6Pt7R4nmwI9AZxs3fOzkQxNo24i9a0Go+N/f3+L4tSnk1TVvcbVjXM5zDDEvGg7PxqvewZRKVDmvvVA5Fa0NFYgJP0itxN9vV6T+4I45/P5lreFIYm3ibqNZvY9WJEwtRXf9tBzp6egQDPo0Xr03jCo2jSNFEUxusrt7L41g5Rzy9riqK6qo6e4tqa0VCODSIiEUxJ99VDGVjCN1cqD10QeE2Z7VWvBiqKQ6/Xav56SJXUidHEU4swtP8lEITP1vkMIo54emr1X8rERSM9G1EMgOWAusZYD6+tvNGAZ23xY4UIIcj6f5XQ69U1o6mPFIO9sBBoX2pNNHY5F9/TeNaX14wRKjdbPdcc1S4OzOV15Hc3w7Qg7R8mu22+zCA9NWLJ+lShq2hLBlojz000Ymij8gZzmJUVO05SSSSfpm5spfRySFrsXLVEieEdTNcWhIxC61nq0fg2rp4NkrJd8Xg3m6qEMbAvr2eg0NdNAL4+I8wxxfiYCoSeDZBQ1m6PNxvNiZdQRBz2qowyDTHEogVAdruu6FweslUfPJwJTUcVGglXRZ+XxTB0Tygo62hypqZriEAIhMcaPO2lxUqQKbg8j6zgxM97pPGNpmRRDVFTN0G2l/vW59fSx64hzlK/s5PBWgfR32JcmlX0biDg6x/kkccDLBUKEwUzEpWijsRFjrkkaHsjksnPd9tzoNOxkaurseH8i8hXigJcKFEJIfqN0TW1mqss7WicOpzQ1uj414q57SUvHNFonpqdX2+X1lwSbpvloccBLBUK3FL9po6dYYIRcZDw6jmpwqg4zN4a11Bh6enSpYmEKLY4esf+m3uSh6kD2ytciiQwzEVFInGrOtvTYcnpeucJocSDNEcThUIaMayV62mvXdXI6naRtW6nr+iGHsfOrRR6LfKloZgVKFfvscUEc1HBs84njxTG8SiwKlLFfNIV6zjROLqKZjmo2D7NfaJwaZ7Ni6TqOHqfSy6NUAcFjHH4HUf+6K271QO4zoEBPQsuCWzu+paObjlx2XUziQq/KRhwUR+2vpomke2mIYHjd/oorpMJsgDURjAJl7BcnTH/wGDXP7fXo49dRTD+GWEiQbaTABLfcH7/KnQmA94OIF8JteknbtoslAQo0sz/UlnCV26sY6GbDvr5mJH9qeX0cdoIb1vF0MkSGZlYLfLlcRv9+IQUFSuwHxUgUJpewybL+XxhoHrRc9m/qOHTE0fOUnv1ZIN9COWTNKD0FUtuHOBg/e/Y+tUQ4YSLykOxiCEZ/xz+3TpSL7uFhJuKWMbOfFwhXOsbO7FTWufk1a9FlgLmCpV5ubmglVT3PPTZERhQjt/bM9hDoEKPxS+AK11f5WjG2ypSaFoJj0reefaTQEQdN1RHnBR06AmlxdA3nmRHO09zkjpflHIMtTiLHwZjZM07Tz0Qg26vaejLwGNtMRYhU05QTSZZeX3OydK9OJ8efMNh6KIF0xNkj2hwV/IMUyPPK4Q0vhxBI92J0xJn6EJcixFItJLX9qchljzNnzGxpe3r/EAfFwE/j7TMSIU7q9xH1/dQJ0kz1klJ4ru4ccXXknOq5QZhn5jjv4C1JdAhh1BW31dqt292b1P5zxUVXHONmuP9KcT4+ibYFt9RXkqeaB50XrElgpxLquedyWCN8jLHvhn9KcpzLywXCOBUGPPWJs+V/DBjq9SFS7pWfI02uPPbY7HP2MYZFdHf823hbHQgC6CkVMcbR7x/q1/W/OrA1E89xTiXVuTWeqSqzTo6PIs5PDmVYseyviNmhhFRksIIs9fKwzFJPy76m5wYdSRzwkwLl7gOi2dmIqUljeozLbjNVeFzKkxBxdK/qiFCgDeBY7NekMa3URjgbzaxEWib0oo4acSwUaAdwrDq510Lh9xDtXCPdVH1KDYcCvQFEH4iFyJT7q2BHggIRF3sItO4XmwgxUCDiggIRFxSIuKBAxAUFIi4oEHFBgYgLCkRcUCDiggIRFxSIuKBAxAUFIi4oEHFBgYgLCkRcUCDiYpdvpn7aXGGyHUYg4oICERcUiLigQMQFBSIuKBBxQYGICwpEXFAg4oICERcUiLigQMQFBSIuKBBxQYGICwpEXFAg4oICERcUiLigQMTF/2UguyfFowBWAAAAAElFTkSuQmCC';
    const _iXxxhdpi = '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';
    function _b64(b) { const bytes = atob(b); const arr = new Uint8Array(bytes.length); for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i); return arr.buffer; }
    root.file('app/src/main/res/mipmap-mdpi/ic_launcher.png',       _b64(_iMdpi));
    root.file('app/src/main/res/mipmap-mdpi/ic_launcher_round.png', _b64(_iMdpi));
    root.file('app/src/main/res/mipmap-hdpi/ic_launcher.png',       _b64(_iHdpi));
    root.file('app/src/main/res/mipmap-hdpi/ic_launcher_round.png', _b64(_iHdpi));
    root.file('app/src/main/res/mipmap-xhdpi/ic_launcher.png',      _b64(_iXhdpi));
    root.file('app/src/main/res/mipmap-xhdpi/ic_launcher_round.png',_b64(_iXhdpi));
    root.file('app/src/main/res/mipmap-xxhdpi/ic_launcher.png',     _b64(_iXxhdpi));
    root.file('app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png',_b64(_iXxhdpi));
    root.file('app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',    _b64(_iXxxhdpi));
    root.file('app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',_b64(_iXxxhdpi));

    // ── LOGO PANTALLA FONDO TRANSPARENTE ──
    const _logoDrawable = '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';
    root.file('app/src/main/res/drawable/logo_clubwalls.png', _b64(_logoDrawable));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `LiveWallpaper_${clubName.replace(/\s+/g,'_')}.zip`; a.click();
    URL.revokeObjectURL(url);
    saveStatus.textContent = '✅ ZIP descargado. Abrí en Android Studio.';
    setTimeout(() => { saveStatus.textContent = ''; }, 5000);
  } catch (err) { alert('Error al generar ZIP: ' + err.message); }
  finally { btnExport.textContent = '📦 Exportar ZIP Android'; btnExport.disabled = false; }
});

// ── CONFIG ──
function buildConfig() {
  return { club: clubNameInput.value.trim(), layers: state.layers.map(l => ({ id: l.id, name: l.name, url: l.url, depth: l.depth })) };
}

// ── BUILDERS ANDROID ──
function buildMainActivity(pkg, clubName) {
  return `package ${pkg}\n\nimport android.app.WallpaperManager\nimport android.content.ComponentName\nimport android.content.Intent\nimport android.os.Bundle\nimport android.view.View\nimport androidx.appcompat.app.AppCompatActivity\nimport ${pkg}.databinding.ActivityMainBinding\n\nclass MainActivity : AppCompatActivity() {\n    private lateinit var binding: ActivityMainBinding\n    private val wallpaperManager by lazy { WallpaperManager.getInstance(this) }\n\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        binding = ActivityMainBinding.inflate(layoutInflater)\n        setContentView(binding.root)\n        binding.clubTitle.text = getString(R.string.club_name)\n        checkWallpaperState()\n        binding.btnSetWallpaper.setOnClickListener {\n            val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {\n                putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,\n                    ComponentName(this@MainActivity, WallpaperService::class.java))\n            }\n            startActivity(intent)\n        }\n    }\n\n    override fun onResume() {\n        super.onResume()\n        checkWallpaperState()\n    }\n\n    private fun checkWallpaperState() {\n        val info = wallpaperManager.wallpaperInfo\n        val isActive = info?.packageName == packageName\n        if (isActive) {\n            binding.btnSetWallpaper.visibility = View.GONE\n            binding.subtitle.text = getString(R.string.wallpaper_active)\n            binding.subtitle.setTextColor(android.graphics.Color.parseColor(\"#000000\"))\n        } else {\n            binding.btnSetWallpaper.visibility = View.VISIBLE\n            binding.subtitle.text = getString(R.string.wallpaper_description_short)\n            binding.subtitle.setTextColor(android.graphics.Color.parseColor(\"#888888\"))\n        }\n    }\n}\n`;
}

function buildWallpaperService(pkg) {
  return `package ${pkg}\n\nimport android.service.wallpaper.WallpaperService\nimport android.view.SurfaceHolder\n\nclass WallpaperService : WallpaperService() {\n    override fun onCreateEngine(): Engine = ParallaxEngine()\n\n    inner class ParallaxEngine : Engine() {\n        private lateinit var renderer: ParallaxRenderer\n\n        override fun onCreate(surfaceHolder: SurfaceHolder) {\n            super.onCreate(surfaceHolder)\n            renderer = ParallaxRenderer(applicationContext)\n            renderer.loadConfig()\n        }\n\n        override fun onVisibilityChanged(visible: Boolean) {\n            if (visible) renderer.startRendering(surfaceHolder)\n            else renderer.stopRendering()\n        }\n\n        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {\n            renderer.onSizeChanged(width, height)\n        }\n\n        override fun onSurfaceDestroyed(holder: SurfaceHolder) {\n            renderer.stopRendering()\n        }\n\n        override fun onDestroy() {\n            renderer.stopRendering()\n            super.onDestroy()\n        }\n    }\n}\n`;
}

function buildParallaxRenderer(pkg) {
  return `package ${pkg}\n\nimport android.content.Context\nimport android.graphics.Bitmap\nimport android.graphics.BitmapFactory\nimport android.graphics.Canvas\nimport android.graphics.Color\nimport android.graphics.Paint\nimport android.view.SurfaceHolder\nimport kotlinx.coroutines.*\nimport org.json.JSONObject\nimport java.io.InputStream\nimport java.net.URL\nimport kotlin.math.sin\n\nclass ParallaxRenderer(private val context: Context) {\n    data class Layer(val bitmap: Bitmap, val depth: Float)\n\n    private val layers = java.util.concurrent.CopyOnWriteArrayList<Layer>()\n    private val paint   = Paint(Paint.ANTI_ALIAS_FLAG)\n    private var width   = 0\n    private var height  = 0\n    private var running = false\n    private var renderJob: Job? = null\n    private val scope   = CoroutineScope(Dispatchers.IO)\n    private var frameCount = 0L\n\n    fun loadConfig() {\n        scope.launch {\n            try {\n                val json = context.assets.open("config.json").bufferedReader().use { it.readText() }\n                val obj  = JSONObject(json)\n                val arr  = obj.getJSONArray("layers")\n                for (i in 0 until arr.length()) {\n                    val layer  = arr.getJSONObject(i)\n                    val url    = layer.getString("url")\n                    val depth  = layer.getInt("depth") / 100f\n                    val bitmap = downloadBitmap(url)\n                    if (bitmap != null) layers.add(Layer(bitmap, depth))\n                }\n            } catch (e: Exception) { e.printStackTrace() }\n        }\n    }\n\n    private fun downloadBitmap(url: String): Bitmap? {\n        return try {\n            val stream: InputStream = URL(url).openStream()\n            BitmapFactory.decodeStream(stream)\n        } catch (e: Exception) { null }\n    }\n\n    fun onSizeChanged(w: Int, h: Int) { width = w; height = h }\n\n    fun startRendering(holder: SurfaceHolder) {\n        running = true\n        renderJob = scope.launch(Dispatchers.Default) {\n            while (running) {\n                val canvas = holder.lockHardwareCanvas() ?: continue\n                try { drawFrame(canvas) } finally { holder.unlockCanvasAndPost(canvas) }\n                delay(16L)\n                frameCount++\n            }\n        }\n    }\n\n    fun stopRendering() { running = false; renderJob?.cancel() }\n\n    private fun drawFrame(canvas: Canvas) {\n        canvas.drawColor(Color.BLACK)\n        val time = frameCount * 0.025\n        layers.forEachIndexed { index, layer ->\n            val maxOffset = 50f * layer.depth\n            // cada capa tiene fase y velocidad distinta para dar sensacion 3D\n            val phase = index * 1.3\n            val tx = (sin(time + phase) * maxOffset).toFloat()\n            val ty = (sin(time * 0.7 + phase + 0.5) * maxOffset * 0.5f).toFloat()\n            val scaleX = width.toFloat()  / layer.bitmap.width\n            val scaleY = height.toFloat() / layer.bitmap.height\n            val scale  = maxOf(scaleX, scaleY) * 1.3f\n            canvas.save()\n            canvas.translate((width - layer.bitmap.width * scale) / 2f + tx, (height - layer.bitmap.height * scale) / 2f + ty)\n            canvas.scale(scale, scale)\n            canvas.drawBitmap(layer.bitmap, 0f, 0f, paint)\n            canvas.restore()\n        }\n    }\n}\n`;
}

function buildManifest(pkg) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.SET_WALLPAPER" />\n    <uses-feature android:name="android.software.live_wallpaper" android:required="true" />\n    <application android:allowBackup="true" android:label="@string/app_name" android:supportsRtl="true" android:theme="@style/Theme.LiveWallpaper" android:hardwareAccelerated="true">\n        <activity android:name=".MainActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n        <service android:name=".WallpaperService" android:enabled="true" android:exported="true" android:label="@string/app_name" android:permission="android.permission.BIND_WALLPAPER">\n            <intent-filter><action android:name="android.service.wallpaper.WallpaperService" /></intent-filter>\n            <meta-data android:name="android.service.wallpaper" android:resource="@xml/wallpaper_info" />\n        </service>\n    </application>\n</manifest>\n`;
}

function buildStringsXml(clubName) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${clubName} — Club Walls</string>\n    <string name="club_name">${clubName}</string>\n    <string name="wallpaper_description">Fondo animado 3D oficial del ${clubName}</string>\n    <string name="wallpaper_description_short">Fondo Animado 3D</string>\n    <string name="wallpaper_active">\u2713 Fondo activo</string>\n    <string name="btn_set_wallpaper">ACTIVAR FONDO ANIMADO</string>\n</resources>\n`;
}

function buildColorsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="black">#FF000000</color>\n    <color name="white">#FFFFFFFF</color>\n    <color name="gray">#FF888888</color>\n</resources>\n`;
}

function buildThemesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="Theme.LiveWallpaper" parent="Theme.MaterialComponents.Light.NoActionBar">\n        <item name="colorPrimary">#000000</item>\n        <item name="colorOnPrimary">#FFFFFF</item>\n        <item name="android:windowBackground">#FFFFFF</item>\n        <item name="android:statusBarColor">#FFFFFF</item>\n        <item name="android:windowLightStatusBar">true</item>\n    </style>\n</resources>\n`;
}

function buildWallpaperInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<wallpaper xmlns:android="http://schemas.android.com/apk/res/android" android:description="@string/wallpaper_description" />\n`;
}

function buildGradientXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <gradient android:type="radial" android:gradientRadius="800dp" android:startColor="#1A00E5FF" android:endColor="#FF080C10" android:centerX="0.5" android:centerY="0.3"/>\n</shape>\n`;
}

function buildLayoutXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#FFFFFF">

    <ImageView
        android:id="@+id/logoImage"
        android:layout_width="80dp"
        android:layout_height="80dp"
        android:src="@drawable/logo_clubwalls"
        android:scaleType="fitCenter"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toTopOf="@id/brandName"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintVertical_chainStyle="packed"
        android:layout_marginBottom="10dp"/>

    <TextView
        android:id="@+id/brandName"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="CLUB WALLS"
        android:textSize="11sp"
        android:textColor="#AAAAAA"
        android:letterSpacing="0.3"
        app:layout_constraintTop_toBottomOf="@id/logoImage"
        app:layout_constraintBottom_toTopOf="@id/divider"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginBottom="18dp"/>

    <View
        android:id="@+id/divider"
        android:layout_width="32dp"
        android:layout_height="1dp"
        android:background="#E0E0E0"
        app:layout_constraintTop_toBottomOf="@id/brandName"
        app:layout_constraintBottom_toTopOf="@id/clubTitle"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginBottom="18dp"/>

    <TextView
        android:id="@+id/clubTitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/club_name"
        android:textSize="24sp"
        android:textStyle="bold"
        android:textColor="#000000"
        android:textAllCaps="true"
        android:letterSpacing="0.12"
        app:layout_constraintTop_toBottomOf="@id/divider"
        app:layout_constraintBottom_toTopOf="@id/subtitle"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginBottom="6dp"/>

    <TextView
        android:id="@+id/subtitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Fondo Animado 3D"
        android:textSize="12sp"
        android:textColor="#888888"
        app:layout_constraintTop_toBottomOf="@id/clubTitle"
        app:layout_constraintBottom_toTopOf="@id/btnSetWallpaper"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginBottom="48dp"/>

    <Button
        android:id="@+id/btnSetWallpaper"
        android:layout_width="0dp"
        android:layout_height="50dp"
        android:text="@string/btn_set_wallpaper"
        android:textColor="#FFFFFF"
        android:backgroundTint="#000000"
        android:letterSpacing="0.08"
        android:textSize="12sp"
        app:layout_constraintTop_toBottomOf="@id/subtitle"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginStart="40dp"
        android:layout_marginEnd="40dp"
        android:layout_marginBottom="80dp"/>

</androidx.constraintlayout.widget.ConstraintLayout>
`;
}

function buildAppGradle(pkg) {
  return `plugins {\n    id 'com.android.application'\n    id 'org.jetbrains.kotlin.android'\n}\n\nandroid {\n    namespace '${pkg}'\n    compileSdk 35\n\n    defaultConfig {\n        applicationId "${pkg}"\n        minSdk 26\n        targetSdk 35\n        versionCode 1\n        versionName "1.0"\n    }\n\n    buildFeatures {\n        viewBinding true\n    }\n\n    buildTypes {\n        release {\n            minifyEnabled false\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n        }\n    }\n\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }\n\n    kotlinOptions {\n        jvmTarget = '17'\n    }\n}\n\ndependencies {\n    implementation 'androidx.core:core-ktx:1.15.0'\n    implementation 'androidx.appcompat:appcompat:1.7.0'\n    implementation 'com.google.android.material:material:1.12.0'\n    implementation 'androidx.constraintlayout:constraintlayout:2.2.0'\n    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1'\n}\n`;
}

function buildRootGradle() {
  return `plugins {\n    id 'com.android.application' version '8.7.3' apply false\n    id 'org.jetbrains.kotlin.android' version '2.0.21' apply false\n}\n`;
}

function buildSettingsGradle(slug) {
  return `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = "LiveWallpaper_${slug}"\ninclude ':app'\n`;
}

function buildGradleProperties() {
  return `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nkotlin.code.style=official\nandroid.nonTransitiveRClass=true\n`;
}

function buildGradleWrapper() {
  return `distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip\nnetworkTimeout=10000\nvalidateDistributionUrl=true\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n`;
}

function buildGradlewSh() {
  return `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd -P)"\nCLASSPATH=$DIR/gradle/wrapper/gradle-wrapper.jar\nif [ -n "$JAVA_HOME" ] ; then JAVACMD="$JAVA_HOME/bin/java"; else JAVACMD=java; fi\nexec "$JAVACMD" -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"\n`;
}

function buildGradlewBat() {
  return `@ECHO OFF\r\nSET DIR=%~dp0\r\nSET CLASSPATH=%DIR%\\gradle\\wrapper\\gradle-wrapper.jar\r\nIF DEFINED JAVA_HOME (SET JAVA_EXE=%JAVA_HOME%\\bin\\java.exe) ELSE (SET JAVA_EXE=java.exe)\r\n"%JAVA_EXE%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*\r\n`;
}

function buildAndroidReadme(clubName) {
  return `# ${clubName} Live Wallpaper 3D (Android)\n\nProyecto Android generado desde el editor web.\n\n## Pasos\n\n1. Descomprimí el ZIP y abrilo en Android Studio.\n2. Esperá el Gradle Sync.\n3. Build > Build APK(s).\n4. Instalá el APK y activá el live wallpaper desde la app.\n\n## Efecto\n\nLas capas se mueven automáticamente en loop con un efecto parallax 3D.\nCada capa flota a distinta velocidad según su profundidad configurada.\n`;
}
