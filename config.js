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
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzphw6Hb6_Ia2PP_PfVFxHWoe4LTNfTo6RwP1mgkggYrnMXRo706UQamBFlUZ8Rhln0/exec",

  // --- MERCADOPAGO ---
  // 1. Creá cuenta en mercadopago.com.ar
  // 2. En Developers → Credenciales → Producción
  // 3. Copiá tu Public Key aquí
  // NOTA: El preference_id se genera desde Apps Script
  MERCADOPAGO_PUBLIC_KEY: "APP_USR-1346782831864696-062412-2c137b40d5e9acd66f01f24b4906a6c3-803088979",

  // --- GITHUB PAGES ---
  // URL base donde está publicada tu web
  BASE_URL: "https://disenoweeb.github.io/protector3d/editor",

};
