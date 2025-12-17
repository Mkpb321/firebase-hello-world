// Firebase App (Initialisierung) + Firestore (Datenbank) als ES-Module von Googles CDN
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

// Firebase Projekt-Konfiguration (aus der Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBdyurJosE1H9iG6Inde7ptCb-aRBl6Hks",
  authDomain: "my-hobby-apps.firebaseapp.com",
  projectId: "my-hobby-apps",
  storageBucket: "my-hobby-apps.firebasestorage.app",
  messagingSenderId: "894079667150",
  appId: "1:894079667150:web:507a35d1d3a2aa457ef99f"
};

// Minimaler Guard: ohne Config kann Firebase nicht initialisiert werden
if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
  throw new Error("Missing Firebase config");
}

// Firebase App initialisieren (Client verbindet sich mit deinem Firebase Projekt)
const app = initializeApp(firebaseConfig);

// Firestore Instanz holen (Zugriff auf Cloud Firestore)
const db = getFirestore(app);

// DOM-Referenzen für Rendering und Senden
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("messageInput");

// Collection-Referenz: entspricht "messages" Collection in Firestore
const messagesRef = collection(db, "messages");

// Query: sortiert nach createdAt (aufsteigend) und begrenzt auf die letzten 100 Dokumente
const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

// Timestamp hübsch formatieren (Firestore Timestamp -> Date -> lokales Time-Format)
function formatTime(ts) {
  if (!ts) return "…";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Rendering der aktuellen Query-Ergebnisse in die Liste
function renderMessages(docs) {
  messagesEl.innerHTML = "";

  for (const docSnap of docs) {
    // serverTimestamps:"estimate" erlaubt ein sinnvolles UI, bevor Serverzeit final bestätigt ist
    const data = docSnap.data({ serverTimestamps: "estimate" });

    const li = document.createElement("li");
    li.textContent = `[${formatTime(data.createdAt)}] ${data.text ?? ""}`;
    messagesEl.appendChild(li);
  }

  // Am Ende bleiben (klassisches Chat-Verhalten)
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Echtzeit-Listener: Firestore pusht Updates automatisch (neue/änderte Dokumente)
onSnapshot(
  messagesQuery,
  { includeMetadataChanges: true },
  (snapshot) => renderMessages(snapshot.docs),
  () => {}
);

// Submit-Handler: schreibt eine neue Nachricht als Dokument in die Collection
formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  // UI-Input bereinigen
  const text = inputEl.value.trim();
  if (!text) return;

  try {
    // addDoc erstellt ein neues Dokument; serverTimestamp() wird serverseitig gesetzt (stabile Zeitbasis)
    await addDoc(messagesRef, { text, createdAt: serverTimestamp() });

    // Input zurücksetzen für schnelles Weiterchatten
    inputEl.value = "";
    inputEl.focus();
  } catch {
    // Keine Console-Ausgabe; im Fehlerfall bleibt die Eingabe stehen
  }
});
