
// ============================================================
//  editor.js — VERSIÓN CORREGIDA COMPLETA
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

// ── JSONP — evita CORS con Apps Script ──
function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout: Apps Script no respondió en 15 segundos'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      if (script.parentNode) document.body.removeChild(script);
    }

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Error al cargar Apps Script'));
    };

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
      state.layers.push({
        id:    `layer_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        name:  file.name,
        url,
        depth: 50,
      });
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
  formData.append('file',          file);
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

// ── RENDER CAPAS ──
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
        <button class="layer-remove" data-index="${idx}">✕</button>
      </div>
      <div class="layer-depth-row">
        <span class="layer-depth-label">Profundidad</span>
        <input type="range" class="depth-slider" min="0" max="100"
               value="${layer.depth}" data-index="${idx}" />
        <span class="depth-value">${layer.depth}</span>
      </div>
    `;

    item.querySelector('.depth-slider').addEventListener('input', e => {
      const i   = parseInt(e.target.dataset.index);
      const val = parseInt(e.target.value);
      state.layers[i].depth = val;
      item.querySelector('.depth-value').textContent = val;
      renderParallaxPreview();
    });

    item.querySelector('.layer-remove').addEventListener('click', e => {
      e.stopPropagation();
      state.layers.splice(parseInt(e.target.dataset.index), 1);
      renderLayers();
      renderParallaxPreview();
    });

    item.addEventListener('dragstart', e => {
      state.dragSrc = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); });
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

// ── RENDER PREVIEW ──
function renderParallaxPreview() {
  if (state.layers.length === 0) {
    parallaxStage.innerHTML = '<p class="preview-placeholder">Subí capas PNG para ver el preview</p>';
    return;
  }
  parallaxStage.innerHTML = state.layers.map((layer, i) => `
    <div class="parallax-layer"
         style="background-image:url('${layer.url}');z-index:${i}"
         data-depth="${layer.depth}">
    </div>
  `).join('');
}

// ── PARALLAX CON MOUSE ──
function initMouseParallax() {
  const phoneScreen = document.getElementById('phoneScreen');

  phoneScreen.addEventListener('mousemove', e => {
    const rect = phoneScreen.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width  - 0.5;
    const cy = (e.clientY - rect.top)  / rect.height - 0.5;
    parallaxStage.querySelectorAll('.parallax-layer').forEach(layer => {
      const depth = parseFloat(layer.dataset.depth) / 100;
      layer.style.transform = `translate3d(${cx * 20 * depth}px, ${cy * 20 * depth}px, 0)`;
    });
  });

  phoneScreen.addEventListener('mouseleave', () => {
    parallaxStage.querySelectorAll('.parallax-layer').forEach(l => {
      l.style.transform = 'translate3d(0,0,0)';
    });
  });
}

// ── TOGGLE VISTA ──
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('previewContainer')
      .classList.toggle('full-view', btn.dataset.view === 'full');
  });
});

// ── GUARDAR EN SHEETS ──
btnSave.addEventListener('click', async () => {
  const clubName = clubNameInput.value.trim();
  if (!clubName)                 { alert('Ingresá el nombre del club'); return; }
  if (state.layers.length === 0) { alert('Agregá al menos una capa');  return; }

  btnSave.disabled       = true;
  saveStatus.textContent = '💾 Guardando...';

  try {
    const params = new URLSearchParams({
      action:      'saveWallpaper',
      nombre_club: clubName,
      precio:      parseFloat(clubPriceInput.value) || 2.99,
      url_apk:     apkUrlInput.value.trim(),
      json_config: JSON.stringify(buildConfig()),
    });

    const data = await fetchJsonp(`${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`);

    if (data.success) {
      saveStatus.textContent = `✅ Guardado con ID: ${data.id}`;
    } else {
      throw new Error(data.error || 'Error desconocido');
    }
  } catch (err) {
    saveStatus.textContent = `❌ Error: ${err.message}`;
    console.error(err);
  } finally {
    btnSave.disabled = false;
    setTimeout(() => { saveStatus.textContent = ''; }, 5000);
  }
});

// ── EXPORTAR ZIP ──
btnExport.addEventListener('click', async () => {
  const clubName = clubNameInput.value.trim();
  if (!clubName)                 { alert('Ingresá el nombre del club'); return; }
  if (state.layers.length === 0) { alert('Agregá al menos una capa');  return; }

  btnExport.textContent = '⏳ Generando ZIP...';
  btnExport.disabled    = true;

  try {
    const zip    = new JSZip();
    const config = buildConfig();
    const slug   = clubName.replace(/\s+/g, '_').toLowerCase();
    const pkg    = 'com.wallpaper.' + slug.replace(/[^a-z0-9]/g, '');
    const root   = zip.folder('LiveWallpaper_' + clubName.replace(/\s+/g, ''));

    // config.json va en assets/ para que ParallaxRenderer lo encuentre
    root.file('app/src/main/assets/config.json', JSON.stringify(config, null, 2));

    const kp = `app/src/main/kotlin/${pkg.replace(/\./g, '/')}/`;
    root.file(kp + 'MainActivity.kt',     buildMainActivity(pkg, clubName));
    root.file(kp + 'WallpaperService.kt', buildWallpaperService(pkg));
    root.file(kp + 'ParallaxRenderer.kt', buildParallaxRenderer(pkg));

    root.file('app/src/main/res/values/strings.xml',       buildStringsXml(clubName));
    root.file('app/src/main/res/values/colors.xml',        buildColorsXml());
    root.file('app/src/main/res/values/themes.xml',        buildThemesXml());
    root.file('app/src/main/res/xml/wallpaper_info.xml',   buildWallpaperInfoXml());
    root.file('app/src/main/res/drawable/bg_gradient.xml', buildGradientXml());
    root.file('app/src/main/res/layout/activity_main.xml', buildLayoutXml());

    // Íconos placeholder (1x1 px PNG transparente en base64)
    const iconPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const iconDensities = [
      ['mipmap-mdpi',    iconPng],
      ['mipmap-hdpi',    iconPng],
      ['mipmap-xhdpi',   iconPng],
      ['mipmap-xxhdpi',  iconPng],
      ['mipmap-xxxhdpi', iconPng],
    ];
    iconDensities.forEach(([folder, data]) => {
      root.file(`app/src/main/res/${folder}/ic_launcher.png`,       atob(data), { binary: true });
      root.file(`app/src/main/res/${folder}/ic_launcher_round.png`, atob(data), { binary: true });
    });

    root.file('app/src/main/AndroidManifest.xml', buildManifest(pkg));
    root.file('app/build.gradle',                 buildAppGradle(pkg));
    root.file('app/proguard-rules.pro',           '# Add project specific ProGuard rules here.\n');
    root.file('build.gradle',                     buildRootGradle());
    root.file('settings.gradle',                  buildSettingsGradle(slug));
    root.file('gradle.properties',                buildGradleProperties());
    root.file('gradle/wrapper/gradle-wrapper.properties', buildGradleWrapper());
    root.file('.gitignore', '*.iml\n.gradle\n/local.properties\n/.idea\n/build\n');

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `LiveWallpaper_${clubName.replace(/\s+/g,'_')}.zip`; a.click();
    URL.revokeObjectURL(url);

    saveStatus.textContent = '✅ ZIP descargado. Abrí en Android Studio.';
    setTimeout(() => { saveStatus.textContent = ''; }, 5000);
  } catch (err) {
    alert('Error al generar ZIP: ' + err.message);
  } finally {
    btnExport.textContent = '📦 Exportar ZIP Android';
    btnExport.disabled    = false;
  }
});

// ── CONFIG ──
function buildConfig() {
  return {
    club: clubNameInput.value.trim(),
    layers: state.layers.map(l => ({ id: l.id, name: l.name, url: l.url, depth: l.depth }))
  };
}

// ── BUILDERS ANDROID ──

function buildMainActivity(pkg, clubName) {
  return `package ${pkg}

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val clubTitle      = findViewById<TextView>(R.id.clubTitle)
        val btnSetWallpaper = findViewById<Button>(R.id.btnSetWallpaper)

        clubTitle.text = getString(R.string.club_name)

        btnSetWallpaper.setOnClickListener {
            val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
                putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    ComponentName(this@MainActivity, LiveWallpaperService::class.java)
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

class LiveWallpaperService : WallpaperService() {
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
            gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
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
                tiltX += (event.values[1] * smoothing)
                tiltY += (event.values[0] * smoothing)
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
import android.graphics.Color
import android.graphics.Paint
import android.view.SurfaceHolder
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.InputStream
import java.net.URL

class ParallaxRenderer(private val context: Context) {
    data class Layer(val bitmap: Bitmap, val depth: Float)

    private val layers  = mutableListOf<Layer>()
    private val paint   = Paint(Paint.ANTI_ALIAS_FLAG)
    private var width   = 0
    private var height  = 0
    private var tiltX   = 0f
    private var tiltY   = 0f
    private var running = false
    private var renderJob: Job? = null
    private val scope   = CoroutineScope(Dispatchers.IO)

    fun loadConfig() {
        scope.launch {
            try {
                val json = context.assets.open("config.json").bufferedReader().use { it.readText() }
                val obj  = JSONObject(json)
                val arr  = obj.getJSONArray("layers")
                for (i in 0 until arr.length()) {
                    val layer  = arr.getJSONObject(i)
                    val url    = layer.getString("url")
                    val depth  = layer.getInt("depth") / 100f
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
        } catch (e: Exception) { null }
    }

    fun onSizeChanged(w: Int, h: Int) { width = w; height = h }
    fun updateTilt(x: Float, y: Float) { tiltX = x; tiltY = y }

    fun startRendering(holder: SurfaceHolder) {
        running = true
        renderJob = scope.launch(Dispatchers.Default) {
            while (running) {
                val canvas = holder.lockCanvas() ?: continue
                try { drawFrame(canvas) } finally { holder.unlockCanvasAndPost(canvas) }
                delay(16L)
            }
        }
    }

    fun stopRendering() {
        running = false
        renderJob?.cancel()
    }

    private fun drawFrame(canvas: Canvas) {
        canvas.drawColor(Color.BLACK)
        layers.forEach { layer ->
            val maxOffset = 60f * layer.depth
            val tx = tiltX * maxOffset
            val ty = tiltY * maxOffset
            val scaleX = width.toFloat()  / layer.bitmap.width
            val scaleY = height.toFloat() / layer.bitmap.height
            val scale  = maxOf(scaleX, scaleY) * 1.2f
            canvas.save()
            canvas.translate(
                (width  - layer.bitmap.width  * scale) / 2f + tx,
                (height - layer.bitmap.height * scale) / 2f + ty
            )
            canvas.scale(scale, scale)
            canvas.drawBitmap(layer.bitmap, 0f, 0f, paint)
            canvas.restore()
        }
    }
}
`;
}

function buildManifest(pkg) {
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

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
            android:name=".LiveWallpaperService"
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
    <string name="wallpaper_description">Fondo 3D parallax del ${clubName}</string>
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

function buildThemesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.LiveWallpaper" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="colorPrimary">@color/accent</item>
        <item name="colorOnPrimary">@color/black</item>
        <item name="android:windowBackground">@color/black</item>
        <item name="android:statusBarColor">@color/black</item>
    </style>
</resources>
`;
}

function buildWallpaperInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/wallpaper_description" />
`;
}

function buildGradientXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <gradient
        android:type="radial"
        android:gradientRadius="800dp"
        android:startColor="#1A00E5FF"
        android:endColor="#FF080C10"
        android:centerX="0.5"
        android:centerY="0.3" />
</shape>
`;
}

function buildLayoutXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/black">

    <TextView
        android:id="@+id/iconEmoji"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="⚽"
        android:textSize="72sp"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toTopOf="@id/clubTitle"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintVertical_chainStyle="packed"
        android:layout_marginBottom="24dp" />

    <TextView
        android:id="@+id/clubTitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/club_name"
        android:textSize="32sp"
        android:textStyle="bold"
        android:textColor="@color/white"
        android:textAllCaps="true"
        app:layout_constraintTop_toBottomOf="@id/iconEmoji"
        app:layout_constraintBottom_toTopOf="@id/btnSetWallpaper"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginBottom="48dp" />

    <Button
        android:id="@+id/btnSetWallpaper"
        android:layout_width="0dp"
        android:layout_height="56dp"
        android:text="@string/btn_set_wallpaper"
        android:textColor="@color/black"
        android:backgroundTint="@color/accent"
        app:layout_constraintTop_toBottomOf="@id/clubTitle"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginStart="40dp"
        android:layout_marginEnd="40dp"
        android:layout_marginBottom="80dp" />

</androidx.constraintlayout.widget.ConstraintLayout>
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
        viewBinding false
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
  return `plugins {
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

function buildGradleWrapper() {
  return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
}





Claude es IA y puede cometer errores. Por favor, verifica nuevamente las respuestas.
