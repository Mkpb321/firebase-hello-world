/**
 * Minimaler "Hello World Chat" (Firestore)
 *
 * Anforderungen aus deiner Nachricht:
 * - so wenig Design wie möglich (UI bleibt simpel)
 * - alle Status-/Fehler-/OK-Meldungen ausschließlich in die Konsole
 * - verständlicher Code mit vielen Kommentaren (aber nicht unnötig lang)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/** Einheitlicher Prefix für Console-Logs */
const TAG = "[hello-firebase-chat]";

/** Kleine Log-Helper, damit die Konsole “sauber” bleibt */
function info(...args)  { console.info(TAG, ...args); }
function warn(...args)  { console.warn(TAG, ...args); }
function error(...args) { console.error(TAG, ...args); }

/**
 * TODO: Firebase Config aus der Firebase Console einfügen.
 * (Project settings -> Your apps -> Web app)
 */
const firebaseConfig = {
  apiKey: "AIzaSyBdyurJosE1H9iG6Inde7ptCb-aRBl6Hks",
  authDomain: "my-hobby-apps.firebaseapp.com",
  projectId: "my-hobby-apps",
  storageBucket: "my-hobby-apps.firebasestorage.app",
  messagingSenderId: "894079667150",
  appId: "1:894079667150:web:507a35d1d3a2aa457ef99f"
};

/** Sehr einfache Plausibilitätsprüfung: verhindert “stilles” Scheitern */
function configLooksUnconfigured(cfg) {
  // Wenn projectId oder apiKey noch Platzhalter sind, stoppen wir mit klarer Meldung.
  const hasPlaceholder =
    !cfg ||
    typeof cfg !== "object" ||
    String(cfg.projectId || "").includes("REPLACE_ME") ||
    String(cfg.apiKey || "").includes("REPLACE_ME");

  return hasPlaceholder;
}

if (configLooksUnconfigured(firebaseConfig)) {
  error("Firebase Config ist nicht gesetzt. Bitte in app.js firebaseConfig ersetzen.");
  // Early exit: ohne Config macht nichts Sinn.
  throw new Error("Missing Firebase config");
}

info("Starte App…");

/**
 * Browser-Online/Offline Events:
 * Das ist nicht “Firestore-Connection-Status”, aber hilft bei Diagnose.
 */
window.addEventListener("online", () => info("Browser meldet: ONLINE"));
window.addEventListener("offline", () => warn("Browser meldet: OFFLINE (keine Internetverbindung)"));

/** Firebase + Firestore initialisieren */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
info("Firebase initialisiert. Firestore Instanz erstellt.");

/** DOM-Referenzen */
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("messageInput");

/** Collection "messages" */
const messagesRef = collection(db, "messages");

/**
 * Query: die letzten 100 Messages nach createdAt sortiert (älteste oben)
 * Hinweis: createdAt wird serverseitig gesetzt (serverTimestamp()).
 */
const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

/** Formatiert Firestore Timestamp (kann anfangs null/undefined sein) */
function formatTime(ts) {
  if (!ts) return "…";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Rendert die komplette Liste neu (für Demo ok) */
function renderMessages(docs) {
  messagesEl.innerHTML = "";

  for (const docSnap of docs) {
    const data = docSnap.data({ serverTimestamps: "estimate" });

    const li = document.createElement("li");
    li.textContent = `[${formatTime(data.createdAt)}] ${data.text ?? ""}`;
    messagesEl.appendChild(li);
  }

  // Chat-typisch: immer nach unten scrollen
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * “Verbindungs”-Logs:
 * Firestore bietet keinen simplen onConnected()/onDisconnected() Callback.
 * Praktischer Workaround: snapshot.metadata.fromCache beobachten.
 * - fromCache=false: Daten kommen vom Server (gutes Signal: Backend erreichbar)
 * - fromCache=true: Daten kommen aus Cache (möglicherweise offline/unterbrochen)
 */
let hasSeenServerSnapshot = false;
let lastFromCache = null;

info("Starte Realtime Listener (onSnapshot) …");

onSnapshot(
  messagesQuery,
  // includeMetadataChanges=true, damit wir fromCache-Transitions sehen
  { includeMetadataChanges: true },
  (snapshot) => {
    // 1) Diagnose: Quelle der Daten (Cache vs Server)
    const fromCache = snapshot.metadata.fromCache;

    // Nur loggen, wenn sich der Zustand ändert (sonst spammt es)
    if (lastFromCache !== fromCache) {
      lastFromCache = fromCache;

      if (fromCache) {
        // “Möglicherweise offline” — kann auch kurz beim Start passieren.
        warn("Listener liefert Daten AUS CACHE. Verbindung zum Server evtl. weg oder noch nicht hergestellt.");
      } else {
        hasSeenServerSnapshot = true;
        info("Listener liefert Daten VOM SERVER. Verbindung zur DB wirkt OK.");
      }
    }

    // 2) UI aktualisieren
    renderMessages(snapshot.docs);
  },
  (err) => {
    // Harte Fehler (z.B. permission-denied, falsche Config, etc.)
    error("onSnapshot Fehler:", err?.code || "(no-code)", err?.message || err);
  }
);

/**
 * Message senden:
 * - Bei Erfolg: positive Meldung in Konsole
 * - Bei Fehler: Fehlermeldung in Konsole
 * - Zusätzlich: “Watchdog”-Warnung, falls addDoc sehr lange hängt (z.B. offline)
 */
formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = inputEl.value.trim();
  if (!text) return;

  info("Sende Nachricht…");

  // Watchdog: wenn das Promise lange nicht auflöst, warnen wir (ohne UI-Blocker).
  let watchdogFired = false;
  const watchdog = setTimeout(() => {
    watchdogFired = true;
    warn("Speichern dauert ungewöhnlich lange. Möglicherweise keine DB-Verbindung / offline.");
  }, 5000);

  try {
    // serverTimestamp() sorgt für konsistente Zeiten auf dem Backend
    const docRef = await addDoc(messagesRef, {
      text,
      createdAt: serverTimestamp()
    });

    clearTimeout(watchdog);
    info("Gespeichert (Backend bestätigt). Doc-ID:", docRef.id);

    inputEl.value = "";
    inputEl.focus();
  } catch (err) {
    clearTimeout(watchdog);

    // Typische Fälle: permission-denied (Rules), unavailable (Netz), invalid-argument, etc.
    error(
      "Speichern fehlgeschlagen:",
      err?.code || "(no-code)",
      err?.message || err
    );

    // Falls Watchdog schon gelaufen ist, ist das extra Kontext.
    if (watchdogFired) {
      warn("Zusatzinfo: Watchdog hatte zuvor bereits auf mögliche Offline-Situation hingewiesen.");
    }
  }
});
