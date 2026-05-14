// ============================================================
//  editor.js — Editor de wallpapers 3D
//  Cloudinary upload + drag&drop layers + parallax + ZIP export
// ============================================================

// ── Estado global ──
const state = {
  layers: [],       // [{ id, name, url, depth }]
  dragSrc: null,
};

// ── Elementos DOM ──
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

// ── 1. Login ──
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

// ── 2. Upload a Cloudinary ──
layerInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  uploadProgress.style.display = 'block';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    progressText.textContent = `Subiendo ${i + 1}/${files.length}: ${file.name}`;
    progressFill.style.width = `${((i) / files.length) * 100}%`;

    try {
      const url = await uploadToCloudinary(file);
      const layer = {
        id:    `layer_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        name:  file.name,
        url,
        depth: 50,
      };
      state.layers.push(layer);
      renderLayers();
      renderParallaxPreview();
    } catch (err) {
      alert(`Error al subir ${file.name}: ${err.message}`);
    }
  }

  progressFill.style.width = '100%';
  progressText.textContent = '✅ Listo';
  setTimeout(() => { uploadProgress.style.display = 'none'; }, 1500);
  layerInput.value = '';
});

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file',         file);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder',        'wallpapers');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

// ── 3. Render lista de capas ──
function renderLayers() {
  if (state.layers.length === 0) {
    layersList.innerHTML = '<p class="empty-layers">No hay capas aún. Subí PNGs arriba.</p>';
    return;
  }

  layersList.innerHTML = '';
  state.layers.forEach((layer, idx) => {
    const item = document.createElement('div');
    item.className     = 'layer-item';
    item.draggable     = true;
    item.dataset.index = idx;

    item.innerHTML = `
      <div class="layer-item-top">
        <img class="layer-thumb" src="${layer.url}" alt="${layer.name}" />
        <span class="layer-name" title="${layer.name}">${layer.name}</span>
        <button class="layer-remove" data-index="${idx}" title="Eliminar capa">✕</button>
      </div>
      <div class="layer-depth-row">
        <span class="layer-depth-label">Profundidad</span>
        <input type="range" class="depth-slider" min="0" max="100"
               value="${layer.depth}" data-index="${idx}" />
        <span class="depth-value">${layer.depth}</span>
      </div>
    `;

    // Depth slider
    const slider = item.querySelector('.depth-slider');
    slider.addEventListener('input', e => {
      const i    = parseInt(e.target.dataset.index);
      const val  = parseInt(e.target.value);
      state.layers[i].depth = val;
      item.querySelector('.depth-value').textContent = val;
      renderParallaxPreview();
    });

    // Remove
    item.querySelector('.layer-remove').addEventListener('click', e => {
      e.stopPropagation();
      state.layers.splice(parseInt(e.target.dataset.index), 1);
      renderLayers();
      renderParallaxPreview();
    });

    // Drag & drop
    item.addEventListener('dragstart', e => {
      state.dragSrc = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.classList.add('dragging'), 0);
    });

    item.addEventListener('dragend', () => item.classList.remove('dragging'));

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      const targetIdx = parseInt(item.dataset.index);
      if (state.dragSrc === null || state.dragSrc === targetIdx) return;

      const moved = state.layers.splice(state.dragSrc, 1)[0];
      state.layers.splice(targetIdx, 0, moved);
      state.dragSrc = null;
      renderLayers();
      renderParallaxPreview();
    });

    layersList.appendChild(item);
  });
}

// ── 4. Render preview parallax ──
function renderParallaxPreview() {
  if (state.layers.length === 0) {
    parallaxStage.innerHTML = '<p class="preview-placeholder">Subí capas PNG para ver el preview</p>';
    return;
  }

  parallaxStage.innerHTML = state.layers.map((layer, i) => `
    <div class="parallax-layer"
         id="player-${layer.id}"
         style="background-image:url('${layer.url}');z-index:${i}"
         data-depth="${layer.depth}">
    </div>
  `).join('');
}

// ── 5. Parallax con mouse (simula giroscopio en desktop) ──
function initMouseParallax() {
  const phoneScreen = document.getElementById('phoneScreen');

  phoneScreen.addEventListener('mousemove', e => {
    const rect = phoneScreen.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;

    const layers = parallaxStage.querySelectorAll('.parallax-layer');
    layers.forEach(layer => {
      const depth = parseFloat(layer.dataset.depth) / 100;
      const maxPx = 20;
      const tx = cx * maxPx * depth;
      const ty = cy * maxPx * depth;
      layer.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    });
  });

  phoneScreen.addEventListener('mouseleave', () => {
    parallaxStage.querySelectorAll('.parallax-layer').forEach(l => {
      l.style.transform = 'translate3d(0,0,0)';
    });
  });
}

// ── 6. Toggle vista phone / full ──
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const container = document.getElementById('previewContainer');
    container.classList.toggle('full-view', btn.dataset.view === 'full');
  });
});

// ── 7. Guardar en Google Sheets ──
btnSave.addEventListener('click', async () => {
  const clubName = clubNameInput.value.trim();
  if (!clubName) { alert('Ingresá el nombre del club'); return; }
  if (state.layers.length === 0) { alert('Agregá al menos una capa'); return; }

  btnSave.disabled    = true;
  saveStatus.textContent = '💾 Guardando...';

  const config = buildConfig();

  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=saveWallpaper`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        nombre_club: clubName,
        precio:      parseFloat(clubPriceInput.value) || 2.99,
        url_apk:     apkUrlInput.value.trim(),
        json_config: JSON.stringify(config),
      })
    });

    const data = await res.json();

    if (data.success) {
      saveStatus.textContent = `✅ Guardado con ID: ${data.id}`;
    } else {
      throw new Error(data.error || 'Error desconocido');
    }
  } catch (err) {
    saveStatus.textContent = `❌ Error: ${err.message}`;
  } finally {
    btnSave.disabled = false;
    setTimeout(() => { saveStatus.textContent = ''; }, 4000);
  }
});

// ── 8. Exportar ZIP para Android Studio ──
btnExport.addEventListener('click', async () => {
  const clubName = clubNameInput.value.trim();
  if (!clubName) { alert('Ingresá el nombre del club'); return; }
  if (state.layers.length === 0) { alert('Agregá al menos una capa'); return; }

  btnExport.textContent = '⏳ Generando ZIP...';
  btnExport.disabled    = true;

  try {
    const zip    = new JSZip();
    const config = buildConfig();
    const slug   = clubName.replace(/\s+/g, '_').toLowerCase();

    // ── Estructura del proyecto Android ──
    const pkg  = 'com.wallpaper.' + slug.replace(/[^a-z0-9]/g, '');
    const root = zip.folder('LiveWallpaper_' + clubName.replace(/\s+/g,''));

    // config.json con capas y profundidades
    root.file('config.json', JSON.stringify(config, null, 2));

    // app/src/main/kotlin/...
    const kotlinPath = `app/src/main/kotlin/${pkg.replace(/\./g,'/')}/`;
    root.file(kotlinPath + 'MainActivity.kt',       buildMainActivity(pkg, clubName));
    root.file(kotlinPath + 'WallpaperService.kt',   buildWallpaperService(pkg));
    root.file(kotlinPath + 'ParallaxRenderer.kt',   buildParallaxRenderer(pkg));

    // res
    root.file('app/src/main/res/values/strings.xml',  buildStringsXml(clubName));
    root.file('app/src/main/res/values/colors.xml',   buildColorsXml());
    root.file('app/src/main/res/xml/wallpaper_info.xml', buildWallpaperInfoXml());

    // AndroidManifest
    root.file('app/src/main/AndroidManifest.xml', buildManifest(pkg));

    // Gradle files
    root.file('app/build.gradle',     buildAppGradle(pkg));
    root.file('build.gradle',         buildRootGradle());
    root.file('settings.gradle',      buildSettingsGradle(slug));
    root.file('gradle.properties',    buildGradleProperties());

    // .gitignore
    root.file('.gitignore', '*.iml\n.gradle\n/local.properties\n/.idea\n/build\n/captures\n');

    // Generar y descargar ZIP
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `LiveWallpaper_${clubName.replace(/\s+/g,'_')}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    saveStatus.textContent = '✅ ZIP descargado. Abrí la carpeta en Android Studio.';
    setTimeout(() => { saveStatus.textContent = ''; }, 5000);

  } catch (err) {
    alert('Error al generar ZIP: ' + err.message);
    console.error(err);
  } finally {
    btnExport.textContent = '📦 Exportar ZIP Android';
    btnExport.disabled    = false;
  }
});

// ── Helpers ──

function buildConfig() {
  return {
    club:   clubNameInput.value.trim(),
    layers: state.layers.map(l => ({
      id:    l.id,
      name:  l.name,
      url:   l.url,
      depth: l.depth,
    }))
  };
}

// ── Android files builders ──

function buildMainActivity(pkg, clubName) {
  return `package ${pkg}

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import ${pkg}.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.clubTitle.text = getString(R.string.club_name)

        binding.btnSetWallpaper.setOnClickListener {
            val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
                putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    ComponentName(this@MainActivity, WallpaperService::class.java)
                )
            }
            startActivity(intent)
        }
    }
}
`;
}

function buildWallpaperService(pkg) {
  return `package ${pkg}

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder

class WallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = ParallaxEngine()

    inner class ParallaxEngine : Engine(), SensorEventListener {

        private lateinit var renderer: ParallaxRenderer
        private lateinit var sensorManager: SensorManager
        private var gyroscope: Sensor? = null

        private var tiltX = 0f
        private var tiltY = 0f
        private val smoothing = 0.08f

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            renderer = ParallaxRenderer(applicationContext)
            renderer.loadConfig()

            sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
            gyroscope      = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            if (visible) {
                gyroscope?.let {
                    sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
                }
                renderer.startRendering(surfaceHolder)
            } else {
                sensorManager.unregisterListener(this)
                renderer.stopRendering()
            }
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            renderer.onSizeChanged(width, height)
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            sensorManager.unregisterListener(this)
            renderer.stopRendering()
        }

        override fun onSensorChanged(event: SensorEvent) {
            if (event.sensor.type == Sensor.TYPE_GYROSCOPE) {
                // Integrar velocidad angular → acumulado suavizado
                tiltX += (event.values[1] * smoothing)
                tiltY += (event.values[0] * smoothing)
                // Limitar rango
                tiltX = tiltX.coerceIn(-1f, 1f)
                tiltY = tiltY.coerceIn(-1f, 1f)
                renderer.updateTilt(tiltX, tiltY)
            }
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

        override fun onDestroy() {
            renderer.stopRendering()
            super.onDestroy()
        }
    }
}
`;
}

function buildParallaxRenderer(pkg) {
  return `package ${pkg}

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.view.SurfaceHolder
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.InputStream
import java.net.URL

class ParallaxRenderer(private val context: Context) {

    data class Layer(
        val bitmap: Bitmap,
        val depth:  Float   // 0.0 – 1.0
    )

    private val layers    = mutableListOf<Layer>()
    private val paint     = Paint(Paint.ANTI_ALIAS_FLAG)
    private var width     = 0
    private var height    = 0
    private var tiltX     = 0f
    private var tiltY     = 0f
    private var running   = false
    private var renderJob: Job? = null
    private val scope     = CoroutineScope(Dispatchers.IO)

    // Cargar config.json y descargar bitmaps
    fun loadConfig() {
        scope.launch {
            try {
                val json = context.assets.open("config.json")
                    .bufferedReader().use { it.readText() }
                val obj  = JSONObject(json)
                val arr  = obj.getJSONArray("layers")

                for (i in 0 until arr.length()) {
                    val layer = arr.getJSONObject(i)
                    val url   = layer.getString("url")
                    val depth = layer.getInt("depth") / 100f

                    val bitmap = downloadBitmap(url)
                    if (bitmap != null) layers.add(Layer(bitmap, depth))
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun downloadBitmap(url: String): Bitmap? {
        return try {
            val stream: InputStream = URL(url).openStream()
            BitmapFactory.decodeStream(stream)
        } catch (e: Exception) {
            null
        }
    }

    fun onSizeChanged(w: Int, h: Int) {
        width  = w
        height = h
    }

    fun updateTilt(x: Float, y: Float) {
        tiltX = x
        tiltY = y
    }

    fun startRendering(holder: SurfaceHolder) {
        running    = true
        renderJob  = scope.launch(Dispatchers.Default) {
            while (running) {
                val canvas = holder.lockCanvas() ?: continue
                try {
                    drawFrame(canvas)
                } finally {
                    holder.unlockCanvasAndPost(canvas)
                }
                delay(16L) // ~60fps
            }
        }
    }

    fun stopRendering() {
        running   = false
        renderJob?.cancel()
    }

    private fun drawFrame(canvas: Canvas) {
        canvas.drawColor(android.graphics.Color.BLACK)

        layers.forEach { layer ->
            val maxOffset = 60f * layer.depth
            val tx = tiltX * maxOffset
            val ty = tiltY * maxOffset

            val scaleX = width.toFloat()  / layer.bitmap.width
            val scaleY = height.toFloat() / layer.bitmap.height
            val scale  = maxOf(scaleX, scaleY) * 1.2f  // 20% extra para el movimiento

            val bw = layer.bitmap.width  * scale
            val bh = layer.bitmap.height * scale
            val left = (width  - bw) / 2f + tx
            val top  = (height - bh) / 2f + ty

            canvas.save()
            canvas.scale(scale, scale, width / 2f, height / 2f)
            canvas.drawBitmap(layer.bitmap, left / scale, top / scale, paint)
            canvas.restore()
        }
    }
}
`;
}

function buildManifest(pkg) {
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${pkg}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.SET_WALLPAPER" />
    <uses-feature android:name="android.software.live_wallpaper" android:required="true" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.LiveWallpaper"
        android:hardwareAccelerated="true">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".WallpaperService"
            android:enabled="true"
            android:exported="true"
            android:label="@string/app_name"
            android:permission="android.permission.BIND_WALLPAPER">
            <intent-filter>
                <action android:name="android.service.wallpaper.WallpaperService" />
            </intent-filter>
            <meta-data
                android:name="android.service.wallpaper"
                android:resource="@xml/wallpaper_info" />
        </service>

    </application>
</manifest>
`;
}

function buildStringsXml(clubName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${clubName} Live Wallpaper 3D</string>
    <string name="club_name">${clubName}</string>
    <string name="wallpaper_description">Fondo de pantalla 3D con efecto parallax del ${clubName}</string>
    <string name="btn_set_wallpaper">ACTIVAR LIVE WALLPAPER</string>
</resources>
`;
}

function buildColorsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
    <color name="accent">#FF00E5FF</color>
</resources>
`;
}

function buildWallpaperInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/wallpaper_description"
    android:thumbnail="@drawable/ic_launcher_foreground" />
`;
}

function buildAppGradle(pkg) {
  return `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace '${pkg}'
    compileSdk 34

    defaultConfig {
        applicationId "${pkg}"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildFeatures {
        viewBinding true
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = '1.8'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
`;
}

function buildRootGradle() {
  return `// Top-level build file
plugins {
    id 'com.android.application' version '8.2.0' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.0' apply false
}
`;
}

function buildSettingsGradle(slug) {
  return `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "LiveWallpaper_${slug}"
include ':app'
`;
}

function buildGradleProperties() {
  return `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`;
}
