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
    const _iMdpi    = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAE2UlEQVR4nO2Y7VMTRxzHw8HdEEOQhFyS3U2grWNLx9oOgqXlnZ0KYx2jpU6BPoCKWv8gO32gIgFfCH14Y32hL0pToZVgW+ShYqEjMFx2j7vkbqDBXHLc9kWHGRwhDySYcSafl5nd334/u7cPkyJKKTU9xzD5DpAtBYF8UxDINwWBfFMQyDcFgXxTshtFhaWlxYGBgUd6IlEEIKIQQg5AsBdC6K6oqLDncqyiXD7m/pmbm73Wf2359q1bDevr61tODsdxMZ7nJYiQhBCKIoQMiBCHEKrwVnk9FovFmsmYORGYnJiY9F/tjY2MjNRTSouyqWWz22QAoAghXIEIarW1tWVvNzbWb9c+q0/o/vj4RL+/TxseHj6cTZ3NKBHFoUQUR1iWQwdfPzhbV1//WrL2Ga+AYRjGryMj93qu9Fj+mp4+kF3cp3G5XKGPPvl49v2WlgaO40pTtU9bQNf1xO1bt4N9/l4w/2j+peyjPkmmwTdIKZCIx7WbN28Gr17p2SeKIsw+6pPsNPgGSfcAxnjpqy++XJiZeYBUVbXtPObTuFyuUMeZzjmfz9fActyOJyajPbC6sqpKsiSHZXlFEISoIAhGSBA4SZLLwrJcEQqFPKlOoc0zTimlmqbFysvLdzw5WR+jsiSJJpPJVOlwOGOx2BrGGBOMFULEx4RgQySEw5hYo9FoacsHLdjn8zXEYtrjbwcHxwcHBw+qilJpsVhWIYQYIqhAiGIAABNE0AwgtEMIgdlstuRcQFhaWuzv61/48caNt3RdZ1mWjTudTrHS4VB53vEvRCiOEGIQQhaIEA8AgKqqRn747vvpgevXa1dXV/cmq88wjNHY2Pj7hc8uWl+pqanJmcDfDx/O+Ht7laGfhhoMw0j7LcVynEYNg9F1nU3ajmXjx947NtrR2Vnl8XqrU9VNW2Di/v3Jvl5/Tm7brWA5Tjt+/HjwbNe5fS6XK+1NnVJgN27bzZj37Ime8J2419HRUePgeVem/ZMKTE9NTQcCAYlgzBEiWnEoxIfDYWcmn852WMutamtr2/iHba1vPNNTSNf1hKooEVkORwRBUEOCEBcEgZElqVQOy2WLC4vetbW1su36V9hs4dOnT0+2trfVRiKRyNTklIAQKvd4PS6Hw5HbFUgFpZSOBYN/mkwmE4DQ7na7IcuyXCQSkQghkkjICiFEI5iYREJKD9XVxXynTh5emJ9f9Pf61Z+Hht7cvJpmszmKPEjwII+CPJ5YVXUV09TcfCjnxyillAYCgeCVr7tts7OzL2/8zjCMUVlZuQwglCCEKwCCBACwGEBQBtxu+/LystLn96/f/e1uXbL6xcXFelNz8+iZc2dhdXX1i8naZiRAKaUjw8Nj33R3W2cezLyabr90YRjGOPLOkdGLly65UwXfIC2B3Q5eUlKSONrUFDx3vgt5vd4XMumbUmAsGPzj88uXzbsRnGXZ+LtHj451ne/ypHNpbUVSgV8CgdHhO3fioijuIUS0EYyBpmnmnUf+H47jYidPnQp+2tmx3+l0gmxqZbyJt3qRypJcIsuyOSQIPMYYbXdPbNy2XRfO7+d53p1N8B0LpCIRj2tEFLFIREUUSRRjrItELLHZbXpbe/sBu93O53K8nAs8a577f+YKAvmmIJBvCgL5piCQbwoC+eY/CbuvfxZnKXUAAAAASUVORK5CYII=';
    const _iHdpi    = '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';
    const _iXhdpi   = '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';
    const _iXxhdpi  = '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';
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
