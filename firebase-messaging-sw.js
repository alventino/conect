/*
 * Service Worker do Firebase Cloud Messaging.
 *
 * IMPORTANTE:
 * mantenha este firebaseConfig igual ao usado no app.js.
 */

importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBf53R2rZHHzj6Nd1j-Ouj-PnVCBHzP9ec",
  authDomain: "ntfy-teste.firebaseapp.com",
  projectId: "ntfy-teste",
  storageBucket: "ntfy-teste.firebasestorage.app",
  messagingSenderId: "183586199542",
  appId: "1:183586199542:web:c3b6b4a719422a6f1c59d7"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/*
 * Mensagens com payload "notification" já podem ser exibidas
 * automaticamente pelo FCM quando a página está em background.
 *
 * Para mensagens somente com "data", mostramos a notificação manualmente.
 */
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Mensagem em background:", payload);

  if (payload.notification) {
    return;
  }

  const data = payload.data || {};
  const title = data.title || "Novo alerta";
  const body = data.body || "Você recebeu uma nova notificação.";
  const icon = data.icon || undefined;
  const url = data.url || "/";

  self.registration.showNotification(title, {
    body,
    icon,
    data: { url }
  });
});

/*
 * Clique das notificações criadas manualmente acima (data-only).
 * Notificações gerenciadas automaticamente pelo FCM continuam usando
 * o comportamento/configuração do próprio FCM, como fcm_options.link.
 */
self.addEventListener("notificationclick", (event) => {
  const url = event.notification?.data?.url;
  if (!url) return;

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
