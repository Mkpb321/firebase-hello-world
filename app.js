// Firebase App Initialisierung (verbindet deinen Client mit dem Firebase Projekt)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

// Firebase Auth (Login/Logout + Session-State)
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Cloud Firestore (Realtime DB: lesen/schreiben, Listener, serverTimestamp)
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

// Firebase App starten
const app = initializeApp(firebaseConfig);

// Auth-Instanz holen (verwaltet Login-Session im Browser)
const auth = getAuth(app);

// Firestore-Instanz holen (Zugriff auf Cloud Firestore)
const db = getFirestore(app);

// DOM: Auth-UI
const authPanel = document.getElementById("authPanel");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authMessage = document.getElementById("authMessage");

// DOM: Chat-UI
const chatPanel = document.getElementById("chatPanel");
const userLabel = document.getElementById("userLabel");
const signOutBtn = document.getElementById("signOutBtn");
const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("messageInput");

// Firestore Collection-Referenz: entspricht der "messages" Collection in Firestore
const messagesRef = collection(db, "messages");

// Query: sortiert nach createdAt (aufsteigend) und begrenzt auf 100 Nachrichten
const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

// Merker für den Firestore-Realtime-Listener (damit wir sauber unsubscriben können)
let unsubscribeMessages = null;

// Firestore Timestamp hübsch formatieren (Timestamp -> Date -> lokales Time-Format)
function formatTime(ts) {
  if (!ts) return "…";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Messages in die Liste rendern (einfach, gut nachvollziehbar)
function renderMessages(docs) {
  messagesEl.innerHTML = "";

  for (const docSnap of docs) {
    // serverTimestamps:"estimate" ergibt sinnvolles UI, bevor die Serverzeit final bestätigt ist
    const data = docSnap.data({ serverTimestamps: "estimate" });
    const li = document.createElement("li");
    li.textContent = `[${formatTime(data.createdAt)}] ${data.text ?? ""}`;
    messagesEl.appendChild(li);
  }

  // Klassisches Chat-Verhalten: nach unten scrollen
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// UI Umschalten je nach Auth-Status
function setSignedInUI(user) {
  const signedIn = Boolean(user);

  authPanel.classList.toggle("hidden", signedIn);
  chatPanel.classList.toggle("hidden", !signedIn);

  authMessage.textContent = "";

  userLabel.textContent = signedIn ? `Angemeldet: ${user.email ?? user.uid}` : "";

  inputEl.disabled = !signedIn;
  formEl.querySelector("button")?.toggleAttribute("disabled", !signedIn);
}

// Firestore Listener starten (nur wenn angemeldet)
function startMessagesListener() {
  // Bereits aktiv -> nichts tun
  if (unsubscribeMessages) return;

  // Echtzeit-Listener: Firestore pusht Änderungen an die Query
  unsubscribeMessages = onSnapshot(
    messagesQuery,
    { includeMetadataChanges: true },
    (snapshot) => renderMessages(snapshot.docs),
    () => {}
  );
}

// Firestore Listener stoppen (z.B. bei Logout)
function stopMessagesListener() {
  if (!unsubscribeMessages) return;
  unsubscribeMessages();
  unsubscribeMessages = null;
  messagesEl.innerHTML = "";
}

// Auth State Listener: wird bei Login/Logout/Refresh automatisch ausgelöst
onAuthStateChanged(auth, (user) => {
  setSignedInUI(user);

  if (user) {
    startMessagesListener();
  } else {
    stopMessagesListener();
  }
});

// Login: Email/Passwort (ohne Registrierung)
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) return;

  try {
    // Firebase Auth: Login mit bestehendem Benutzer (wird in Firebase Console angelegt)
    await signInWithEmailAndPassword(auth, email, password);
    passwordInput.value = "";
  } catch {
    // Minimaler UI-Hinweis (keine Console-Ausgabe)
    authMessage.textContent = "Login fehlgeschlagen. Bitte E-Mail/Passwort prüfen.";
  }
});

// Logout: Session beenden
signOutBtn.addEventListener("click", async () => {
  try {
    // Firebase Auth: Sign-out invalidiert die lokale Session
    await signOut(auth);
  } catch {
    // Absichtlich keine Console-Ausgabe
  }
});

// Nachricht senden: schreibt ein neues Dokument in Firestore
formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Nur senden, wenn angemeldet
  if (!auth.currentUser) return;

  const text = inputEl.value.trim();
  if (!text) return;

  try {
    // serverTimestamp() wird serverseitig gesetzt (stabile Zeitbasis)
    await addDoc(messagesRef, {
      text,
      createdAt: serverTimestamp(),
      uid: auth.currentUser.uid
    });

    inputEl.value = "";
    inputEl.focus();
  } catch {
    // Keine Console-Ausgabe; Eingabe bleibt stehen
  }
});
