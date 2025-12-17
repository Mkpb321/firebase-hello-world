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

const firebaseConfig = {
  apiKey: "AIzaSyBdyurJosE1H9iG6Inde7ptCb-aRBl6Hks",
  authDomain: "my-hobby-apps.firebaseapp.com",
  projectId: "my-hobby-apps",
  storageBucket: "my-hobby-apps.firebasestorage.app",
  messagingSenderId: "894079667150",
  appId: "1:894079667150:web:507a35d1d3a2aa457ef99f"
};

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
  throw new Error("Missing Firebase config");
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("composer");
const inputEl = document.getElementById("messageInput");

const messagesRef = collection(db, "messages");
const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

function formatTime(ts) {
  if (!ts) return "…";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderMessages(docs) {
  messagesEl.innerHTML = "";
  for (const docSnap of docs) {
    const data = docSnap.data({ serverTimestamps: "estimate" });
    const li = document.createElement("li");
    li.textContent = `[${formatTime(data.createdAt)}] ${data.text ?? ""}`;
    messagesEl.appendChild(li);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

onSnapshot(
  messagesQuery,
  { includeMetadataChanges: true },
  (snapshot) => renderMessages(snapshot.docs),
  () => {}
);

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = inputEl.value.trim();
  if (!text) return;

  try {
    await addDoc(messagesRef, { text, createdAt: serverTimestamp() });
    inputEl.value = "";
    inputEl.focus();
  } catch {
    // bewusst keine Console-Ausgabe; Eingabe bleibt stehen
  }
});
