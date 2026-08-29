import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  onUnregistered,
  register
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js";

/*
 * =========================================================
 * 1) COLE A CONFIGURAÇÃO DO SEU APP WEB FIREBASE AQUI
 * =========================================================
 *
 * Firebase Console:
 * Configurações do projeto > Seus apps > App da Web
 *
 * Para o FCM atual, mantenha pelo menos:
 * apiKey, projectId, messagingSenderId e appId.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBf53R2rZHHzj6Nd1j-Ouj-PnVCBHzP9ec",
  authDomain: "ntfy-teste.firebaseapp.com",
  projectId: "ntfy-teste",
  storageBucket: "ntfy-teste.firebasestorage.app",
  messagingSenderId: "183586199542",
  appId: "1:183586199542:web:c3b6b4a719422a6f1c59d7"
};

/*
 * =========================================================
 * 2) COLE SUA CHAVE VAPID PÚBLICA AQUI
 * =========================================================
 *
 * Firebase Console:
 * Configurações do projeto > Cloud Messaging
 * > Configuração da Web > Certificados de Web Push
 */
const VAPID_PUBLIC_KEY = "BEJtu86QsvxX3fZa1wtbVaR0uIzrZNkCPGGUptPbb0fH5BiRM7AasMBHMut1evozbUyJq0vFRLQ1NRxzcdlqgSI";

const statusEl = document.querySelector("#status");
const statusTextEl = document.querySelector("#statusText");
const enableButton = document.querySelector("#enableButton");
const installationIdEl = document.querySelector("#installationId");
const copyButton = document.querySelector("#copyButton");
const messageEl = document.querySelector("#message");
const lastTitleEl = document.querySelector("#lastTitle");
const lastBodyEl = document.querySelector("#lastBody");

let messaging = null;
let serviceWorkerRegistration = null;

function setStatus(text, state = "idle") {
  statusTextEl.textContent = text;
  statusEl.dataset.state = state;
}

function setMessage(text = "") {
  messageEl.textContent = text;
}

function hasPlaceholder(value) {
  return !value || String(value).includes("COLE_");
}

function configIsReady() {
  const requiredConfig = [
    firebaseConfig.apiKey,
    firebaseConfig.projectId,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId,
    VAPID_PUBLIC_KEY
  ];

  return requiredConfig.every((value) => !hasPlaceholder(value));
}

function saveAndShowInstallationId(fid) {
  localStorage.setItem("alertas-fid", fid);
  installationIdEl.value = fid;
  copyButton.disabled = false;
}

function clearInstallationId(fid) {
  const current = localStorage.getItem("alertas-fid");

  if (!fid || current === fid) {
    localStorage.removeItem("alertas-fid");
    installationIdEl.value = "";
    copyButton.disabled = true;
  }
}

function showLastMessage(payload) {
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "Novo alerta";

  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    "Você recebeu uma nova notificação.";

  lastTitleEl.textContent = title;
  lastBodyEl.textContent = body;
}

async function showForegroundSystemNotification(payload) {
  if (
    Notification.permission !== "granted" ||
    !serviceWorkerRegistration
  ) {
    return;
  }

  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "Novo alerta";

  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    "Você recebeu uma nova notificação.";

  const icon =
    payload?.notification?.icon ||
    payload?.data?.icon ||
    undefined;

  const url =
    payload?.data?.url ||
    payload?.fcmOptions?.link ||
    "/";

  await serviceWorkerRegistration.showNotification(title, {
    body,
    icon,
    data: { url }
  });
}

async function registerWithFcm() {
  setStatus("Registrando esta instalação…", "warn");
  enableButton.disabled = true;
  setMessage("");

  try {
    await register(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration
    });

    setStatus("Notificações ativadas", "ok");
    enableButton.textContent = "Notificações ativadas";
    setMessage("Registro concluído. O identificador será atualizado automaticamente se mudar.");
  } catch (error) {
    console.error("Erro ao registrar no FCM:", error);
    setStatus("Falha ao registrar", "error");
    enableButton.disabled = false;
    enableButton.textContent = "Tentar novamente";
    setMessage(`Erro: ${error?.message || error}`);
  }
}

async function requestNotifications() {
  if (!messaging) return;

  if (Notification.permission === "denied") {
    setStatus("Notificações bloqueadas", "error");
    setMessage("Libere as notificações nas configurações do navegador para este site.");
    return;
  }

  try {
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") {
      setStatus("Permissão não concedida", "warn");
      setMessage("As notificações só podem ser ativadas depois que o navegador conceder permissão.");
      return;
    }

    await registerWithFcm();
  } catch (error) {
    console.error(error);
    setStatus("Não foi possível ativar", "error");
    enableButton.disabled = false;
    setMessage(`Erro: ${error?.message || error}`);
  }
}

async function copyInstallationId() {
  const value = installationIdEl.value.trim();
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    setMessage("Identificador copiado para a área de transferência.");
  } catch {
    installationIdEl.focus();
    installationIdEl.select();
    document.execCommand("copy");
    setMessage("Identificador copiado para a área de transferência.");
  }
}

async function start() {
  const cachedFid = localStorage.getItem("alertas-fid");
  if (cachedFid) {
    installationIdEl.value = cachedFid;
    copyButton.disabled = false;
  }

  if (!configIsReady()) {
    setStatus("Configuração Firebase pendente", "warn");
    setMessage(
      "Preencha o firebaseConfig e a VAPID pública em app.js e repita o firebaseConfig em firebase-messaging-sw.js."
    );
    enableButton.disabled = true;
    return;
  }

  if (!window.isSecureContext && location.hostname !== "localhost") {
    setStatus("HTTPS obrigatório", "error");
    setMessage("Abra este site por HTTPS. Para desenvolvimento local, localhost é aceito.");
    return;
  }

  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    setStatus("Navegador incompatível", "error");
    setMessage("Este navegador não oferece os recursos necessários para Web Push.");
    return;
  }

  const supported = await isSupported();

  if (!supported) {
    setStatus("FCM não suportado", "error");
    setMessage("O Firebase Messaging não é suportado neste navegador/ambiente.");
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);

    serviceWorkerRegistration = await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js",
      { scope: "./" }
    );

    onRegistered(messaging, (fid) => {
      console.log("Instalação registrada no FCM:", fid);
      saveAndShowInstallationId(fid);
      setStatus("Notificações ativadas", "ok");
      enableButton.disabled = true;
      enableButton.textContent = "Notificações ativadas";
      setMessage("Este é o identificador que você deve enviar ao administrador.");
    });

    onUnregistered(messaging, (fid) => {
      console.log("Instalação removida do FCM:", fid);
      clearInstallationId(fid);
      setStatus("Registro removido", "warn");
      enableButton.disabled = false;
      enableButton.textContent = "Ativar notificações";
    });

    onMessage(messaging, async (payload) => {
      console.log("Mensagem recebida em primeiro plano:", payload);
      showLastMessage(payload);

      try {
        await showForegroundSystemNotification(payload);
      } catch (error) {
        console.warn("Não foi possível exibir a notificação do sistema:", error);
      }
    });

    enableButton.disabled = false;
    enableButton.addEventListener("click", requestNotifications);
    copyButton.addEventListener("click", copyInstallationId);

    if (Notification.permission === "granted") {
      await registerWithFcm();
    } else if (Notification.permission === "denied") {
      setStatus("Notificações bloqueadas", "error");
      enableButton.disabled = true;
      setMessage("Libere as notificações nas configurações do navegador para este site.");
    } else {
      setStatus("Notificações desativadas", "warn");
      setMessage("Clique em “Ativar notificações” para registrar este navegador.");
    }
  } catch (error) {
    console.error("Falha ao iniciar Firebase Messaging:", error);
    setStatus("Erro de inicialização", "error");
    enableButton.disabled = true;
    setMessage(`Erro: ${error?.message || error}`);
  }
}

start();
