
import { SUPABASE_CONFIG } from "./config.js";

let supabase = null;
let authMode = "signup";
let authSubscription = null;
let recoveryMode = false;

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authTabs = document.getElementById("authTabs");
const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");

const nameField = document.getElementById("nameField");
const emailField = document.getElementById("emailField");
const passwordField = document.getElementById("passwordField");
const confirmPasswordField = document.getElementById("confirmPasswordField");

const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const accountPanel = document.getElementById("accountPanel");
const accountEmail = document.getElementById("accountEmail");
const accountStatus = document.getElementById("accountStatus");
const signOutButton = document.getElementById("signOutButton");

function showMessage(message, type = "info") {
  authMessage.textContent = message;
  authMessage.className = "auth-message " + type;
}

function authPageUrl() {
  return new URL("./auth.html", window.location.href).href;
}

function setMode(mode) {
  authMode = mode;

  const signup = mode === "signup";
  const login = mode === "login";
  const reset = mode === "reset";
  const recovery = mode === "recovery";

  authTabs.classList.toggle("hidden", reset || recovery);
  nameField.classList.toggle("hidden", !signup);
  emailField.classList.toggle("hidden", recovery);
  passwordField.classList.toggle("hidden", reset);
  confirmPasswordField.classList.toggle("hidden", !recovery);

  authTitle.textContent =
    signup ? "إنشاء حساب جديد" :
    login ? "تسجيل الدخول" :
    reset ? "استعادة كلمة المرور" :
    "تعيين كلمة مرور جديدة";

  authSubtitle.textContent =
    signup ? "أدخل بياناتك للانضمام إلى المنصة." :
    login ? "أدخل بريدك الإلكتروني وكلمة المرور." :
    reset ? "سنرسل إلى بريدك رابطاً لإعادة تعيين كلمة المرور." :
    "اختر كلمة مرور جديدة لحسابك.";

  authSubmit.textContent =
    signup ? "إنشاء الحساب" :
    login ? "تسجيل الدخول" :
    reset ? "إرسال رابط الاستعادة" :
    "حفظ كلمة المرور";

  forgotPasswordButton.classList.toggle("hidden", !login);

  document.querySelectorAll(".auth-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  authForm.reset();
  authSubmit.disabled = false;
  showMessage("");
}

function renderSession(session) {
  const signedIn = Boolean(session?.user);

  accountPanel.classList.toggle("hidden", !signedIn);
  authForm.classList.toggle("hidden", signedIn);
  authTabs.classList.toggle("hidden", signedIn);
  forgotPasswordButton.classList.add("hidden");

  if (signedIn) {
    accountEmail.textContent = session.user.email || "حساب مستخدم";
    accountStatus.textContent = "تم تسجيل الدخول بنجاح.";
    authTitle.textContent = "حسابك الشخصي";
    authSubtitle.textContent = "أنت متصل بالمنصة.";
  } else {
    setMode("signup");
  }
}

function friendlyError(error) {
  const message = error?.message || "";

  if (message.includes("Invalid login credentials")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }

  if (message.includes("Email not confirmed")) {
    return "يجب تأكيد بريدك الإلكتروني قبل تسجيل الدخول.";
  }

  if (message.includes("User already registered")) {
    return "هذا البريد مسجل مسبقاً. حاول تسجيل الدخول.";
  }

  if (message.includes("Password should be at least")) {
    return "كلمة المرور قصيرة. استخدم 8 أحرف على الأقل.";
  }

  if (message.includes("rate limit")) {
    return "تم إرسال طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.";
  }

  if (message.includes("Invalid email")) {
    return "صيغة البريد الإلكتروني غير صحيحة.";
  }

  return message || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!supabase) {
    showMessage("الاتصال بالخادم غير جاهز. أعد تحميل الصفحة.", "error");
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const displayName = document.getElementById("displayName").value.trim();

  authSubmit.disabled = true;
  showMessage("جارٍ تنفيذ الطلب...");

  try {
    if (authMode === "signup") {
      if (displayName.length < 2) {
        throw new Error("اكتب اسماً ظاهراً لا يقل عن حرفين.");
      }

      if (password.length < 8) {
        throw new Error("كلمة المرور يجب ألا تقل عن 8 أحرف.");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authPageUrl(),
          data: {
            display_name: displayName
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        renderSession(data.session);
        showMessage("تم إنشاء الحساب وتسجيل الدخول.", "success");
      } else {
        setMode("login");
        showMessage(
          "تم إنشاء الحساب. افتح رسالة التأكيد التي وصلتك إلى بريدك الإلكتروني، واضغط رابط التأكيد قبل تسجيل الدخول.",
          "success"
        );
      }
    }

    else if (authMode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      recoveryMode = false;
      renderSession(data.session);
      showMessage("تم تسجيل الدخول بنجاح.", "success");
    }

    else if (authMode === "reset") {
      if (!email) {
        throw new Error("أدخل بريدك الإلكتروني أولاً.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authPageUrl()
      });

      if (error) throw error;

      showMessage(
        "إذا كان البريد مسجلاً، فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور.",
        "success"
      );
    }

    else if (authMode === "recovery") {
      if (password.length < 8) {
        throw new Error("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.");
      }

      if (password !== confirmPassword) {
        throw new Error("كلمتا المرور غير متطابقتين.");
      }

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      recoveryMode = false;
      showMessage("تم تحديث كلمة المرور بنجاح.", "success");

      const { data } = await supabase.auth.getSession();
      renderSession(data.session);
    }
  } catch (error) {
    console.error("Authentication error:", error);
    showMessage(friendlyError(error), "error");
  } finally {
    authSubmit.disabled = false;
  }
}

async function initializeAuth() {
  try {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.publishableKey) {
      throw new Error("إعدادات Supabase غير مكتملة.");
    }

    // اكتشاف رابط استعادة كلمة المرور قبل عرض واجهة التسجيل
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    const isRecoveryLink =
      hashParams.get("type") === "recovery";

    if (isRecoveryLink) {
      recoveryMode = true;
      setMode("recovery");
      authForm.classList.remove("hidden");
      authTabs.classList.add("hidden");
      accountPanel.classList.add("hidden");
      showMessage("جارٍ التحقق من رابط الاستعادة...");
    }

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

    // الاشتراك بالأحداث فور إنشاء العميل، قبل getSession
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          recoveryMode = true;
          setMode("recovery");
          authForm.classList.remove("hidden");
          accountPanel.classList.add("hidden");
          authTabs.classList.add("hidden");
          showMessage("أدخل كلمة المرور الجديدة.", "info");
          return;
        }

        if (recoveryMode) {
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          renderSession(session);
        }

        if (event === "SIGNED_OUT") {
          renderSession(null);
          showMessage("تم تسجيل الخروج.", "success");
        }
      }
    );

    authSubscription = listener.subscription;

    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    // لا نسمح لنتيجة الجلسة بإلغاء وضع الاستعادة
    if (!recoveryMode) {
      renderSession(data.session);
    }

  } catch (error) {
    console.error("Authentication initialization error:", error);
    showMessage(
      "تعذر تشغيل نظام الحسابات. تحقق من الاتصال ثم أعد تحميل الصفحة.",
      "error"
    );
  }
}

authForm.addEventListener("submit", handleSubmit);

authTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");

  if (button) {
    setMode(button.dataset.mode);
  }
});

forgotPasswordButton.addEventListener("click", () => {
  setMode("reset");
});

signOutButton.addEventListener("click", async () => {
  if (!supabase) return;

  signOutButton.disabled = true;

  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    recoveryMode = false;
    renderSession(null);
    showMessage("تم تسجيل الخروج بنجاح.", "success");
  } catch (error) {
    showMessage(friendlyError(error), "error");
  } finally {
    signOutButton.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  authSubscription?.unsubscribe();
});

initializeAuth();
