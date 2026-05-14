// ============================================================
//  config.js — Configuración del proyecto
//  IMPORTANTE: Completá estos valores antes de publicar
// ============================================================

const CONFIG = {

  // --- CONTRASEÑA DEL EDITOR ---
  // Cambiala por una contraseña segura
  EDITOR_PASSWORD: "clubwalls2025",

  // --- CLOUDINARY ---
  // 1. Creá cuenta en cloudinary.com (gratis)
  // 2. En Settings → Upload → Add upload preset
  //    Poné "Signing Mode" en UNSIGNED
  //    Guardá el nombre del preset abajo
  CLOUDINARY_CLOUD_NAME: "TU_CLOUD_NAME",   // Ej: "dxyz123abc"
  CLOUDINARY_UPLOAD_PRESET: "TU_PRESET",    // Ej: "wallpapers_unsigned"

  // --- GOOGLE APPS SCRIPT ---
  // 1. Creá el script en script.google.com
  // 2. Pegá el código de apps-script/Code.gs
  // 3. Deployá como Web App (acceso: Anyone)
  // 4. Copiá la URL aquí
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec",

  // --- MERCADOPAGO ---
  // 1. Creá cuenta en mercadopago.com.ar
  // 2. En Developers → Credenciales → Producción
  // 3. Copiá tu Public Key aquí
  // NOTA: El preference_id se genera desde Apps Script
  MERCADOPAGO_PUBLIC_KEY: "APP_USR-TU_PUBLIC_KEY",

  // --- GITHUB PAGES ---
  // URL base donde está publicada tu web
  BASE_URL: "https://TU_USUARIO.github.io/wallpaper-builder",

};
