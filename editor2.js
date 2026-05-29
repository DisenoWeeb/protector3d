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
  return `package ${pkg}\n\nimport android.app.WallpaperManager\nimport android.content.ComponentName\nimport android.content.Intent\nimport android.os.Bundle\nimport androidx.appcompat.app.AppCompatActivity\nimport ${pkg}.databinding.ActivityMainBinding\n\nclass MainActivity : AppCompatActivity() {\n    private lateinit var binding: ActivityMainBinding\n\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        binding = ActivityMainBinding.inflate(layoutInflater)\n        setContentView(binding.root)\n        binding.clubTitle.text = getString(R.string.club_name)\n        binding.btnSetWallpaper.setOnClickListener {\n            val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {\n                putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,\n                    ComponentName(this@MainActivity, WallpaperService::class.java))\n            }\n            startActivity(intent)\n        }\n    }\n}\n`;
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
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${clubName} Live Wallpaper 3D</string>\n    <string name="club_name">${clubName}</string>\n    <string name="wallpaper_description">Fondo 3D parallax del ${clubName}</string>\n    <string name="btn_set_wallpaper">ACTIVAR LIVE WALLPAPER</string>\n</resources>\n`;
}

function buildColorsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="black">#FF000000</color>\n    <color name="white">#FFFFFFFF</color>\n    <color name="accent">#FF00E5FF</color>\n</resources>\n`;
}

function buildThemesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="Theme.LiveWallpaper" parent="Theme.MaterialComponents.DayNight.NoActionBar">\n        <item name="colorPrimary">@color/accent</item>\n        <item name="colorOnPrimary">@color/black</item>\n        <item name="android:windowBackground">@color/black</item>\n        <item name="android:statusBarColor">@color/black</item>\n    </style>\n</resources>\n`;
}

function buildWallpaperInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<wallpaper xmlns:android="http://schemas.android.com/apk/res/android" android:description="@string/wallpaper_description" />\n`;
}

function buildGradientXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android">\n    <gradient android:type="radial" android:gradientRadius="800dp" android:startColor="#1A00E5FF" android:endColor="#FF080C10" android:centerX="0.5" android:centerY="0.3"/>\n</shape>\n`;
}

function buildLayoutXml() {
  return `<?xml version="1.0" encoding="utf-8"?>\n<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android" xmlns:app="http://schemas.android.com/apk/res-auto" android:layout_width="match_parent" android:layout_height="match_parent" android:background="@color/black">\n    <TextView android:id="@+id/iconEmoji" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="⚽" android:textSize="72sp" app:layout_constraintTop_toTopOf="parent" app:layout_constraintBottom_toTopOf="@id/clubTitle" app:layout_constraintStart_toStartOf="parent" app:layout_constraintEnd_toEndOf="parent" app:layout_constraintVertical_chainStyle="packed" android:layout_marginBottom="24dp"/>\n    <TextView android:id="@+id/clubTitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="@string/club_name" android:textSize="32sp" android:textStyle="bold" android:textColor="@color/white" android:textAllCaps="true" app:layout_constraintTop_toBottomOf="@id/iconEmoji" app:layout_constraintBottom_toTopOf="@id/btnSetWallpaper" app:layout_constraintStart_toStartOf="parent" app:layout_constraintEnd_toEndOf="parent" android:layout_marginBottom="48dp"/>\n    <Button android:id="@+id/btnSetWallpaper" android:layout_width="0dp" android:layout_height="56dp" android:text="@string/btn_set_wallpaper" android:textColor="@color/black" android:backgroundTint="@color/accent" app:layout_constraintTop_toBottomOf="@id/clubTitle" app:layout_constraintBottom_toBottomOf="parent" app:layout_constraintStart_toStartOf="parent" app:layout_constraintEnd_toEndOf="parent" android:layout_marginStart="40dp" android:layout_marginEnd="40dp" android:layout_marginBottom="80dp"/>\n</androidx.constraintlayout.widget.ConstraintLayout>\n`;
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
