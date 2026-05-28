// ============================================================
//  config.js — Configuración del proyecto
//  IMPORTANTE: Completá estos valores antes de publicar
// ============================================================

const CONFIG = {

  // --- CONTRASEÑA DEL EDITOR ---
  // Cambiala por una contraseña segura
  EDITOR_PASSWORD: "1234",

  // --- CLOUDINARY ---
  // 1. Creá cuenta en cloudinary.com (gratis)
  // 2. En Settings → Upload → Add upload preset
  //    Poné "Signing Mode" en UNSIGNED
  //    Guardá el nombre del preset abajo
  CLOUDINARY_CLOUD_NAME: "dwgwbdtud",   // Ej: "dxyz123abc"
  CLOUDINARY_UPLOAD_PRESET: "dra_bruzera_unsigned",    // Ej: "wallpapers_unsigned"

  // --- GOOGLE APPS SCRIPT ---
  // 1. Creá el script en script.google.com
  // 2. Pegá el código de apps-script/Code.gs
  // 3. Deployá como Web App (acceso: Anyone)
  // 4. Copiá la URL aquí
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyjwo6HXmAz2QZyKo60HGS9tXLs8E5FwmIy17-LBBjmQjRJgJhItRuF-mLpCfzZg4CR/exec",

  // --- MERCADOPAGO ---
  // 1. Creá cuenta en mercadopago.com.ar
  // 2. En Developers → Credenciales → Producción
  // 3. Copiá tu Public Key aquí
  // NOTA: El preference_id se genera desde Apps Script
  MERCADOPAGO_PUBLIC_KEY: "APP_USR-4b134e7e-5b8a-4a0a-87af-813507e8e60a",

  // --- GITHUB PAGES ---
  // URL base donde está publicada tu web
  BASE_URL: "https://disenoweeb.github.io/protector3d",

};
