
import { SUPABASE_CONFIG } from "./config.js";

let supabase = null;

const statusText = document.getElementById("connectionStatus");
const statusDot = document.getElementById("connectionDot");
const retryButton = document.getElementById("retryConnection");

function updateStatus(message, state = "checking") {
  if (statusText) {
    statusText.textContent = message;
  }

  if (statusDot) {
    statusDot.classList.remove("online", "offline");

    if (state === "online") {
      statusDot.classList.add("online");
    } else if (state === "offline") {
      statusDot.classList.add("offline");
    }
  }
}

function validateConfiguration() {
  const { url, publishableKey } = SUPABASE_CONFIG;

  if (!url || !publishableKey) {
    throw new Error("بيانات الاتصال بـ Supabase غير مكتملة.");
  }

  if (!url.startsWith("https://")) {
    throw new Error("عنوان Supabase غير صالح.");
  }

  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("مفتاح Supabase المستخدم ليس Publishable Key.");
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("المتصفح لا يدعم Service Worker.");
    return;
  }

  if (!window.isSecureContext) {
    console.warn("يحتاج Service Worker إلى HTTPS.");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./"
    });

    console.info("Service Worker registered:", registration.scope);
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

async function initializeSupabase() {
  updateStatus("جارٍ تجهيز الاتصال بـ Supabase...");

  try {
    validateConfiguration();

    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2.57.0"
    );

    supabase = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    await testConnection();

  } catch (error) {
    console.error("Supabase initialization error:", error);

    updateStatus(
      "تعذر تجهيز الاتصال. تحقق من الإنترنت وإعدادات المشروع.",
      "offline"
    );
  }
}

async function testConnection() {
  if (!supabase) {
    updateStatus("الاتصال غير مهيأ بعد.", "offline");
    return;
  }

  updateStatus("جارٍ فحص الاتصال بالخادم...");

  if (retryButton) {
    retryButton.disabled = true;
    retryButton.textContent = "جارٍ الفحص...";
  }

  try {
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_CONFIG.publishableKey,
          Authorization: `Bearer ${SUPABASE_CONFIG.publishableKey}`,
          Accept: "application/openapi+json"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase returned status ${response.status}`);
    }

    updateStatus(
      "الاتصال بـ Supabase ناجح. الخادم يستجيب بصورة طبيعية.",
      "online"
    );

  } catch (error) {
    console.error("Supabase connection error:", error);

    updateStatus(
      "تعذر الاتصال بالخادم. تحقق من الإنترنت وإعدادات Supabase.",
      "offline"
    );

  } finally {
    if (retryButton) {
      retryButton.disabled = false;
      retryButton.textContent = "إعادة فحص الاتصال";
    }
  }
}

if (retryButton) {
  retryButton.addEventListener("click", testConnection);
}

window.addEventListener("online", () => {
  if (supabase) {
    testConnection();
  }
});

window.addEventListener("offline", () => {
  updateStatus("لا يوجد اتصال بالإنترنت حالياً.", "offline");
});

registerServiceWorker();
initializeSupabase();
