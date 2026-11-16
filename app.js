
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  onValue,
  query,
  limitToLast,
  serverTimestamp,
  onDisconnect,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";


// =======================================
// FIREBASE CONFIGURATION
// =======================================

const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);


// =======================================
// GLOBAL VARIABLES
// =======================================

const $ = id => document.getElementById(id);

let currentUser = null;
let currentProfile = {};
let globalImageFile = null;
let profileImageFile = null;
let groupImageFile = null;
let currentGroupId = null;
let currentTopicId = null;

let unsubscribers = [];
let toastTimer;

const defaultAvatar =
  "https://ui-avatars.com/api/?name=Member&background=e2e8f0&color=334155";


// =======================================
// GENERAL HELPERS
// =======================================

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));

const timeLabel = ts =>
  ts
    ? new Date(ts).toLocaleString([], {
        month:"short",
        day:"numeric",
        hour:"2-digit",
        minute:"2-digit"
      })
    : "just now";

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    $("toast").classList.add("hidden");
  }, 2800);
}

function setBusy(button, busy, label) {
  button.disabled = busy;

  button.innerHTML = busy
    ? '<span class="spinner"></span>'
    : label;
}

function showAuthMessage(message) {
  $("authMessage").textContent = message;
}

function showApp(show) {
  $("authScreen").classList.toggle("hidden", show);
  $("appScreen").classList.toggle("hidden", !show);
}

function switchView(name) {

  document.querySelectorAll(".view").forEach(v =>
    v.classList.remove("active")
  );

  $("view-" + name).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle(
      "nav-active",
      b.dataset.view === name
    )
  );
}


// =======================================
// THEME COLOR
// =======================================

function applyColor(color) {

  document.documentElement.style.setProperty(
    "--accent",
    color
  );

  const n = parseInt(color.slice(1), 16);

  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;

  document.documentElement.style.setProperty(
    "--accent-rgb",
    `${r},${g},${b}`
  );

  localStorage.setItem("n90-color", color);
}

applyColor(
  localStorage.getItem("n90-color") || "#16a34a"
);

$("themeColor").value =
  localStorage.getItem("n90-color") || "#16a34a";

$("themeColor").addEventListener("input", e =>
  applyColor(e.target.value)
);


// =======================================
// IMAGE UPLOAD AND COMPRESSION
// =======================================

async function uploadImage(file, folder) {

  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image must be 8 MB or smaller.");
  }

  const compressed = await compressImage(file);

  const path =
    `${folder}/${currentUser.uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;

  const target = storageRef(storage, path);

  await uploadBytes(target, compressed, {
    contentType:"image/webp"
  });

  return await getDownloadURL(target);
}


async function compressImage(file) {

  if (!("createImageBitmap" in window)) {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    1400 / Math.max(bitmap.width, bitmap.height)
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.round(bitmap.width * scale)
  );

  canvas.height = Math.max(
    1,
    Math.round(bitmap.height * scale)
  );

  canvas.getContext("2d").drawImage(
    bitmap,
    0,
    0,
    canvas.width,
    canvas.height
  );

  bitmap.close?.();

  return await new Promise(resolve =>
    canvas.toBlob(resolve, "image/webp", .78)
  ) || file;
}


function renderAvatar(url, name) {

  return url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Member")}&background=e2e8f0&color=334155`;
}


// =======================================
// USER PROFILE
// =======================================

function updateProfileUI() {

  const name =
    currentProfile.displayName ||
    currentUser.displayName ||
    "Member";

  const photo = renderAvatar(
    currentProfile.photoURL || currentUser.photoURL,
    name
  );

  $("topName").textContent = name;
  $("sideName").textContent = name;

  $("topAvatar").src = photo;
  $("sideAvatar").src = photo;
  $("profilePreview").src = photo;

  $("profileName").value = name;
  $("profileEmail").value = currentUser.email || "";
}


async function loadProfile() {

  const snap = await get(
    ref(db, `users/${currentUser.uid}`)
  );

  currentProfile = snap.val() || {};

  if (!currentProfile.displayName) {

    currentProfile.displayName =
      currentUser.displayName ||
      currentUser.email?.split("@")[0] ||
      "Member";
  }

  updateProfileUI();
}


// =======================================
// ONLINE PRESENCE
// =======================================

async function setPresence() {

  const connectedRef = ref(db, ".info/connected");

  onValue(connectedRef, async snap => {

    if (snap.val() !== true || !currentUser) return;

    const presenceRef =
      ref(db, `status/${currentUser.uid}`);

    await onDisconnect(presenceRef).set({
      state:"offline",
      lastChanged:serverTimestamp(),
      displayName:currentProfile.displayName || "Member"
    });

    await set(presenceRef, {
      state:"online",
      lastChanged:serverTimestamp(),
      displayName:currentProfile.displayName || "Member",
      photoURL:currentProfile.photoURL || ""
    });

  });
}


function listenOnlineUsers() {

  const unsub = onValue(ref(db, "status"), snap => {

    const users = Object.entries(snap.val() || {})
      .filter(([uid, value]) => value.state === "online");

    $("onlineCount").textContent = users.length;

    $("onlineUsers").innerHTML = users.length
      ? users.map(([uid, user]) => `
        <div class="flex items-center gap-2 min-w-0">

          <div class="relative">
            <img class="avatar-sm"
              src="${esc(renderAvatar(user.photoURL,user.displayName))}"
              alt="">

            <span class="online-dot absolute bottom-0 right-0"></span>
          </div>

          <span class="text-sm truncate">
            ${esc(user.displayName || "Member")}
            ${uid === currentUser.uid
              ? '<span class="text-xs text-slate-400">(you)</span>'
              : ''}
          </span>

        </div>
      `).join("")
      : '<p class="text-xs text-slate-400">No one online right now.</p>';

  });

  unsubscribers.push(unsub);
}


// =======================================
// CHAT MESSAGE DISPLAY
// =======================================

function messageMarkup(msg, id) {

  const mine = msg.uid === currentUser.uid;

  return `
    <div class="flex ${mine ? 'justify-end' : 'justify-start'} gap-2"
      data-message="${esc(id)}">

      ${!mine ? `
        <img class="avatar-sm mt-1"
          src="${esc(renderAvatar(msg.photoURL,msg.name))}"
          alt="">
      ` : ''}

      <div class="message-bubble">

        <div class="flex items-center gap-2 mb-1 ${mine ? 'justify-end' : ''}">

          <span class="text-xs font-bold text-slate-600">
            ${esc(mine ? 'You' : msg.name || 'Member')}
          </span>

          <span class="text-[10px] text-slate-400">
            ${esc(timeLabel(msg.createdAt))}
          </span>

        </div>

        <div class="${mine ? 'accent-bg text-white' : 'bg-slate-100 text-slate-800'} rounded-2xl px-3 py-2 text-sm">

          ${msg.text ? `
            <div class="whitespace-pre-wrap">
              ${esc(msg.text)}
            </div>
          ` : ''}

          ${msg.imageURL ? `
            <img src="${esc(msg.imageURL)}"
              loading="lazy"
              class="rounded-xl mt-2 max-h-72 max-w-full object-contain"
              alt="Shared image">
          ` : ''}

        </div>

        ${msg.text ? `
          <div class="flex ${mine ? 'justify-end' : ''} mt-1">

            <button class="translate-btn text-[11px] text-slate-500 hover:accent-text"
              data-text="${encodeURIComponent(msg.text)}">

              <i class="fa-solid fa-language mr-1"></i>
              Translate to English

            </button>

          </div>

          <div class="translation text-xs text-slate-500 mt-1 ${mine ? 'text-right' : ''}"></div>
        ` : ''}

      </div>
    </div>
  `;
}


// =======================================
// REAL-TIME MESSAGE LISTENER
// =======================================

function listenMessages(path, containerId) {

  const target = $(containerId);

  const unsub = onValue(
    query(ref(db, path), limitToLast(100)),
    snap => {

      const messages = Object.entries(snap.val() || {})
        .sort((a, b) =>
          (a[1].createdAt || 0) -
          (b[1].createdAt || 0)
        );

      target.innerHTML = messages.length
        ? messages.map(([id, message]) =>
            messageMarkup(message, id)
          ).join("")
        : `
          <p class="text-center text-sm text-slate-400 py-10">
            No messages yet. Start the conversation!
          </p>
        `;

      target.scrollTop = target.scrollHeight;

    }
  );

  return unsub;
}


// =======================================
// SEND CHAT MESSAGE
// =======================================

async function sendMessage(
  path,
  textId,
  imageFile,
  previewId,
  buttonId
) {

  const text = $(textId).value.trim();

  if (!text && !imageFile) {
    return toast("Write a message or attach an image.");
  }

  const button = $(buttonId);
  const original = button.innerHTML;

  try {

    setBusy(button, true, original);

    let imageURL = "";

    if (imageFile) {
      imageURL = await uploadImage(
        imageFile,
        "chat-images"
      );
    }

    await push(ref(db, path), {

      uid:currentUser.uid,

      name:currentProfile.displayName || "Member",

      photoURL:currentProfile.photoURL || "",

      text,

      imageURL,

      createdAt:serverTimestamp()

    });

    $(textId).value = "";

    if (previewId) {
      $(previewId).classList.add("hidden");
    }

    if (textId === "globalText") {

      globalImageFile = null;
      $("globalImage").value = "";

    } else {

      groupImageFile = null;

    }

  } catch(e) {

    toast(e.message || "Could not send message.");

  } finally {

    button.disabled = false;
    button.innerHTML = original;

  }
}


// =======================================
// AUTOMATIC ENGLISH TRANSLATION
// =======================================

async function translateToEnglish(text, button, output) {

  button.disabled = true;

  button.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Translating...';

  try {

    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|en`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Translation service unavailable.");
    }

    const data = await response.json();

    const translated = data?.responseData?.translatedText;

    if (!translated) {
      throw new Error("Could not translate this message.");
    }

    output.textContent = translated;

  } catch(e) {

    output.textContent =
      "Translation unavailable. Please try again.";

  } finally {

    button.disabled = false;

    button.innerHTML =
      '<i class="fa-solid fa-language mr-1"></i>Translate to English';

  }
}


// =======================================
// EMOJIS
// =======================================

function addEmojiTray(trayId, inputId) {

  const emojis = [
    "😀","😂","🥰","😍","😊",
    "😎","😭","😮","🙏","👏",
    "👍","👎","❤️","🔥","🎉",
    "💯","🌱","🌍","🤝","💚"
  ];

  $(trayId).innerHTML = emojis.map(e => `
    <button type="button"
      class="emoji"
      data-emoji="${e}">
      ${e}
    </button>
  `).join("");

  $(trayId).addEventListener("click", e => {

    const btn = e.target.closest("[data-emoji]");

    if (!btn) return;

    const input = $(inputId);

    input.value += btn.dataset.emoji;

    input.focus();

  });
}

addEmojiTray("globalEmojiTray", "globalText");

document.querySelectorAll("[data-emoji-target]").forEach(btn => {

  btn.addEventListener("click", () => {
    $("globalEmojiTray").classList.toggle("hidden");
  });

});


// =======================================
// AUTHENTICATION
// =======================================

$("signInBtn").addEventListener("click", async () => {

  showAuthMessage("");

  try {

    await signInWithEmailAndPassword(
      auth,
      $("authEmail").value.trim(),
      $("authPassword").value
    );

  } catch(e) {

    showAuthMessage(friendlyAuthError(e));

  }

});


$("signUpBtn").addEventListener("click", async () => {

  showAuthMessage("");

  const name = $("authName").value.trim();
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  if (!name) {
    return showAuthMessage("Enter your display name.");
  }

  try {

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(cred.user, {
      displayName:name
    });

    await set(ref(db, `users/${cred.user.uid}`), {

      displayName:name,
      photoURL:"",
      email,
      createdAt:serverTimestamp()

    });

  } catch(e) {

    showAuthMessage(friendlyAuthError(e));

  }

});


function friendlyAuthError(e) {

  const map = {

    "auth/invalid-email":
      "Enter a valid email address.",

    "auth/weak-password":
      "Password must contain at least 6 characters.",

    "auth/email-already-in-use":
      "This email already has an account.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/network-request-failed":
      "Network error. Check your internet connection."

  };

  return map[e.code] || e.message || "Authentication failed.";
}


$("signOutBtn").addEventListener("click", async () => {

  if (currentUser) {

    await set(ref(db, `status/${currentUser.uid}`), {
      state:"offline",
      lastChanged:serverTimestamp()
    });

  }

  await signOut(auth);

});


// =======================================
// AUTH STATE
// =======================================

onAuthStateChanged(auth, async user => {

  unsubscribers.forEach(fn => fn());
  unsubscribers = [];

  currentUser = user;

  if (!user) {
    showApp(false);
    return;
  }

  showApp(true);

  try {

    await loadProfile();

    await set(
      ref(db, `users/${user.uid}/lastSeen`),
      serverTimestamp()
    );

    await setPresence();

    listenOnlineUsers();

    unsubscribers.push(
      listenMessages("globalChat", "globalMessages")
    );

    listenTopics();

    listenGroups();

  } catch(e) {

    toast("Could not load community data: " + e.message);

  }

});


// =======================================
// PROFILE EDITING
// =======================================

$("profileTopBtn").addEventListener("click", () => {
  switchView("profile");
});


$("profileImage").addEventListener("change", e => {

  profileImageFile = e.target.files?.[0] || null;

  if (profileImageFile) {

    $("profilePreview").src =
      URL.createObjectURL(profileImageFile);

  }

});


$("saveProfile").addEventListener("click", async () => {

  const name = $("profileName").value.trim();

  if (!name) {
    return toast("Display name cannot be empty.");
  }

  const btn = $("saveProfile");

  setBusy(btn, true, "Save profile");

  try {

    let photoURL = currentProfile.photoURL || "";

    if (profileImageFile) {

      photoURL = await uploadImage(
        profileImageFile,
        "profile-images"
      );

    }

    await update(ref(db, `users/${currentUser.uid}`), {

      displayName:name,
      photoURL,
      email:currentUser.email || ""

    });

    await updateProfile(currentUser, {

      displayName:name,
      photoURL:photoURL || null

    });

    currentProfile = {
      ...currentProfile,
      displayName:name,
      photoURL
    };

    await set(ref(db, `status/${currentUser.uid}`), {

      state:"online",
      lastChanged:serverTimestamp(),
      displayName:name,
      photoURL

    });

    updateProfileUI();

    profileImageFile = null;
    $("profileImage").value = "";

    $("profileMessage").textContent =
      "Profile saved successfully.";

    $("profileMessage").className =
      "text-sm mt-3 text-emerald-600";

    toast("Profile updated.");

  } catch(e) {

    $("profileMessage").textContent = e.message;

    $("profileMessage").className =
      "text-sm mt-3 text-rose-600";

  } finally {

    btn.disabled = false;
    btn.textContent = "Save profile";

  }

});


// =======================================
// GLOBAL CHAT
// =======================================

$("globalImage").addEventListener("change", e => {

  globalImageFile = e.target.files?.[0] || null;

  if (globalImageFile) {

    $("globalImagePreview").textContent =
      `Attached: ${globalImageFile.name}`;

    $("globalImagePreview").classList.remove("hidden");

  }

});


$("globalSend").addEventListener("click", () => {

  sendMessage(
    "globalChat",
    "globalText",
    globalImageFile,
    "globalImagePreview",
    "globalSend"
  );

});


$("globalText").addEventListener("keydown", e => {

  if (e.key === "Enter" && !e.shiftKey) {

    e.preventDefault();

    $("globalSend").click();

  }

});


document.addEventListener("click", e => {

  const btn = e.target.closest(".translate-btn");

  if (!btn) return;

  const output = btn.parentElement.nextElementSibling;

  translateToEnglish(
    decodeURIComponent(btn.dataset.text),
    btn,
    output
  );

});


// =======================================
// FORUM: CREATE TOPICS
// =======================================

$("newTopicBtn").addEventListener("click", () => {
  $("topicForm").classList.toggle("hidden");
});


$("cancelTopic").addEventListener("click", () => {
  $("topicForm").classList.add("hidden");
});


$("saveTopic").addEventListener("click", async () => {

  const title = $("topicTitle").value.trim();

  const description =
    $("topicDescription").value.trim();

  if (!title || !description) {
    return toast("Add both a title and description.");
  }

  const btn = $("saveTopic");

  setBusy(btn, true, "Publish topic");

  try {

    await push(ref(db, "forumTopics"), {

      title,
      description,

      uid:currentUser.uid,

      author:currentProfile.displayName,

      photoURL:currentProfile.photoURL || "",

      createdAt:serverTimestamp(),

      commentCount:0

    });

    $("topicTitle").value = "";
    $("topicDescription").value = "";

    $("topicForm").classList.add("hidden");

    toast("Topic published.");

  } catch(e) {

    toast(e.message);

  } finally {

    btn.disabled = false;
    btn.textContent = "Publish topic";

  }

});


// =======================================
// FORUM: DISPLAY TOPICS
// =======================================

function listenTopics() {

  const unsub = onValue(ref(db, "forumTopics"), snap => {

    const topics = Object.entries(snap.val() || {})
      .sort((a,b) =>
        (b[1].createdAt || 0) -
        (a[1].createdAt || 0)
      );

    $("topicsList").innerHTML = topics.length
      ? topics.map(([id,t]) => `

        <button class="topic-open panel p-4 w-full text-left hover:border-slate-300"
          data-id="${esc(id)}">

          <div class="flex justify-between gap-3">

            <h3 class="font-bold">
              ${esc(t.title)}
            </h3>

            <span class="text-xs text-slate-400 whitespace-nowrap">
              ${esc(timeLabel(t.createdAt))}
            </span>

          </div>

          <p class="text-sm text-slate-600 mt-2">
            ${esc(t.description)}
          </p>

          <div class="flex items-center gap-2 mt-3 text-xs text-slate-400">

            <span>By ${esc(t.author || "Member")}</span>
            <span>·</span>
            <span>${Number(t.commentCount || 0)} comments</span>

          </div>

        </button>

      `).join("")
      : `
        <div class="panel p-8 text-center text-slate-400">
          No topics yet. Create the first discussion.
        </div>
      `;

  });

  unsubscribers.push(unsub);

}


$("topicsList").addEventListener("click", e => {

  const item = e.target.closest(".topic-open");

  if (item) {
    openTopic(item.dataset.id);
  }

});


// =======================================
// FORUM: COMMENTS
// =======================================

async function openTopic(id) {

  currentTopicId = id;

  const snap = await get(
    ref(db, `forumTopics/${id}`)
  );

  if (!snap.exists()) return;

  const t = snap.val();

  $("topicDetail").classList.remove("hidden");

  $("topicDetail").innerHTML = `

    <div class="panel p-4">

      <button id="backTopics"
        class="text-sm accent-text mb-3">

        <i class="fa-solid fa-arrow-left mr-1"></i>
        All topics

      </button>

      <h2 class="text-xl font-extrabold">
        ${esc(t.title)}
      </h2>

      <p class="text-xs text-slate-400 mt-1">
        By ${esc(t.author || "Member")}
        · ${esc(timeLabel(t.createdAt))}
      </p>

      <p class="whitespace-pre-wrap text-sm mt-4">
        ${esc(t.description)}
      </p>

      <div class="border-t mt-5 pt-4">

        <h3 class="font-bold mb-3">Comments</h3>

        <div id="topicComments" class="space-y-3 mb-4">
          Loading comments...
        </div>

        <textarea id="topicCommentText"
          class="field" rows="2"
          placeholder="Write a comment..."></textarea>

        <button id="postTopicComment"
          class="btn btn-primary mt-2">
          Post comment
        </button>

      </div>

    </div>

  `;

  $("topicsList").classList.add("hidden");

  $("backTopics").addEventListener("click", () => {

    $("topicDetail").classList.add("hidden");
    $("topicsList").classList.remove("hidden");

  });


  onValue(ref(db, `forumComments/${id}`), snap => {

    const comments = Object.values(snap.val() || {})
      .sort((a,b) =>
        (a.createdAt || 0) -
        (b.createdAt || 0)
      );

    $("topicComments").innerHTML = comments.length
      ? comments.map(c => `

        <div class="bg-slate-50 rounded-xl p-3">

          <div class="text-xs font-bold">

            ${esc(c.author || "Member")}

            <span class="font-normal text-slate-400 ml-1">
              ${esc(timeLabel(c.createdAt))}
            </span>

          </div>

          <p class="text-sm mt-1 whitespace-pre-wrap">
            ${esc(c.text)}
          </p>

        </div>

      `).join("")
      : '<p class="text-sm text-slate-400">No comments yet.</p>';

  });


  $("postTopicComment").addEventListener("click", async () => {

    const text = $("topicCommentText").value.trim();

    if (!text) return;

    await push(ref(db, `forumComments/${id}`), {

      uid:currentUser.uid,

      author:currentProfile.displayName,

      text,

      createdAt:serverTimestamp()

    });

    await runTransaction(
      ref(db, `forumTopics/${id}/commentCount`),
      value => (value || 0) + 1
    );

    $("topicCommentText").value = "";

  });

}


// =======================================
// GROUP CREATION
// =======================================

$("createGroupBtn").addEventListener("click", () => {
  $("groupForm").classList.toggle("hidden");
});


$("cancelGroup").addEventListener("click", () => {
  $("groupForm").classList.add("hidden");
});


$("saveGroup").addEventListener("click", async () => {

  const name = $("groupName").value.trim();

  const description =
    $("groupDescription").value.trim();

  if (!name) return toast("Enter a group name.");

  const btn = $("saveGroup");

  setBusy(btn, true, "Create group");

  try {

    const groupRef = push(ref(db, "groups"));

    const group = {

      name,
      description,

      ownerUid:currentUser.uid,

      createdAt:serverTimestamp(),

      memberCount:1

    };

    await set(groupRef, group);

    await set(
      ref(db, `groupMembers/${groupRef.key}/${currentUser.uid}`),
      {
        role:"owner",
        joinedAt:serverTimestamp(),
        displayName:currentProfile.displayName
      }
    );

    $("groupName").value = "";
    $("groupDescription").value = "";

    $("groupForm").classList.add("hidden");

    toast("Group created.");

  } catch(e) {

    toast(e.message);

  } finally {

    btn.disabled = false;
    btn.textContent = "Create group";

  }

});


// =======================================
// GROUP LIST
// =======================================

function listenGroups() {

  const unsub = onValue(ref(db, "groups"), async snap => {

    const groups = Object.entries(snap.val() || {})
      .sort((a,b) =>
        (b[1].createdAt || 0) -
        (a[1].createdAt || 0)
      );

    const visible = [];

    for (const [id,g] of groups) {

      const memberSnap = await get(
        ref(db, `groupMembers/${id}/${currentUser.uid}`)
      );

      if (
        g.ownerUid === currentUser.uid ||
        memberSnap.exists()
      ) {

        visible.push([id,g]);

      }

    }

    $("groupsList").innerHTML = visible.length
      ? visible.map(([id,g]) => `

        <div class="panel p-4">

          <div class="w-10 h-10 rounded-xl accent-bg text-white flex items-center justify-center mb-3">
            <i class="fa-solid fa-people-group"></i>
          </div>

          <h3 class="font-bold">
            ${esc(g.name)}
          </h3>

          <p class="text-sm text-slate-500 mt-1 min-h-10">
            ${esc(g.description || "Community group")}
          </p>

          <p class="text-xs text-slate-400 mt-2">
            ${Number(g.memberCount || 1)} / 40 members
          </p>

          <button class="open-group btn btn-muted w-full mt-3"
            data-id="${esc(id)}">
            Open group
          </button>

        </div>

      `).join("")
      : `
        <div class="panel p-8 text-center text-slate-400 sm:col-span-2 xl:col-span-3">
          You have not joined any groups yet.
          Create one or join using an invitation link.
        </div>
      `;

  });

  unsubscribers.push(unsub);

}


$("groupsList").addEventListener("click", e => {

  const btn = e.target.closest(".open-group");

  if (btn) {
    openGroup(btn.dataset.id);
  }

});


// =======================================
// OPEN GROUP AND GROUP CHAT
// =======================================

async function openGroup(id) {

  currentGroupId = id;

  const [groupSnap, membersSnap] = await Promise.all([

    get(ref(db, `groups/${id}`)),

    get(ref(db, `groupMembers/${id}`))

  ]);

  if (!groupSnap.exists()) {
    return toast("Group not found.");
  }

  const g = groupSnap.val();

  const members = membersSnap.val() || {};

  const isMember = !!members[currentUser.uid];

  $("groupRoom").classList.remove("hidden");

  $("groupRoom").innerHTML = `

    <div class="p-4 border-b flex items-center justify-between gap-3">

      <div>

        <button id="closeGroup"
          class="text-xs accent-text mb-1">

          <i class="fa-solid fa-arrow-left mr-1"></i>
          Groups

        </button>

        <h3 class="font-extrabold text-lg">
          ${esc(g.name)}
        </h3>

        <p class="text-xs text-slate-500">
          ${Object.keys(members).length} / 40 members
          · ${esc(g.description || "")}
        </p>

      </div>

      <button id="inviteGroup" class="btn btn-muted text-sm">
        <i class="fa-solid fa-link mr-1"></i>
        Invite
      </button>

    </div>

    <div class="px-4 py-3 bg-slate-50 border-b">

      <p class="text-xs font-bold text-slate-500 mb-2">
        MEMBERS
      </p>

      <div class="flex flex-wrap gap-2">

        ${Object.entries(members).map(([uid,m]) => `

          <span class="text-xs bg-white border rounded-full px-3 py-1">

            ${esc(m.displayName || "Member")}

            ${m.role === "owner" ? " · owner" : ""}

          </span>

        `).join("")}

      </div>

    </div>

    ${isMember ? `

      <div id="groupMessages"
        class="chat-scroll p-4 space-y-4"></div>

      <div class="border-t p-3">

        <div id="groupImagePreview"
          class="hidden text-xs text-slate-500 mb-2"></div>

        <div class="flex items-end gap-2">

          <label class="btn btn-muted cursor-pointer">

            <i class="fa-regular fa-image"></i>

            <input id="groupImage"
              type="file"
              accept="image/*"
              class="hidden">

          </label>

          <textarea id="groupText"
            class="field resize-none flex-1"
            rows="1"
            maxlength="2000"
            placeholder="Message this group..."></textarea>

          <button id="groupSend" class="btn btn-primary">
            <i class="fa-solid fa-paper-plane"></i>
          </button>

        </div>

      </div>

    ` : `

      <div class="p-8 text-center">

        <p class="text-sm text-slate-500 mb-3">
          You are not a member of this group.
        </p>

        <button id="joinGroup" class="btn btn-primary">
          Join group
        </button>

      </div>

    `}

  `;


  $("closeGroup").addEventListener("click", () => {
    $("groupRoom").classList.add("hidden");
  });


  $("inviteGroup").addEventListener("click", async () => {

    const inviteURL =
      `${location.origin}${location.pathname}?join=${id}`;

    try {

      await navigator.clipboard.writeText(inviteURL);

      toast("Group invite link copied.");

    } catch {

      prompt("Copy this group invite link:", inviteURL);

    }

  });


  if (!isMember) {

    $("joinGroup").addEventListener("click", async () => {

      try {

        const result = await runTransaction(
          ref(db, `groups/${id}/memberCount`),
          value => {
            const count = value || 0;
            return count < 40 ? count + 1 : undefined;
          }
        );

        if (!result.committed) {
          return toast("This group has reached its 40-member limit.");
        }

        await set(
          ref(db, `groupMembers/${id}/${currentUser.uid}`),
          {
            role:"member",
            joinedAt:serverTimestamp(),
            displayName:currentProfile.displayName
          }
        );

        toast("You joined the group.");

        openGroup(id);

      } catch(e) {

        toast(e.message);

      }

    });

    return;

  }


  const unsub = listenMessages(
    `groupChats/${id}`,
    "groupMessages"
  );

  unsubscribers.push(unsub);

  groupImageFile = null;


  $("groupImage").addEventListener("change", e => {

    groupImageFile = e.target.files?.[0] || null;

    if (groupImageFile) {

      $("groupImagePreview").textContent =
        `Attached: ${groupImageFile.name}`;

      $("groupImagePreview").classList.remove("hidden");

    }

  });


  $("groupSend").addEventListener("click", () => {

    sendMessage(
      `groupChats/${id}`,
      "groupText",
      groupImageFile,
      "groupImagePreview",
      "groupSend"
    );

  });


  $("groupText").addEventListener("keydown", e => {

    if (e.key === "Enter" && !e.shiftKey) {

      e.preventDefault();

      $("groupSend").click();

    }

  });

}


// =======================================
// GROUP INVITATION DEEP LINK
// =======================================

const joinId =
  new URLSearchParams(location.search).get("join");

if (joinId) {

  const joinWatcher = onAuthStateChanged(auth, user => {

    if (user) {

      switchView("groups");

      setTimeout(() => openGroup(joinId), 700);

      joinWatcher();

    }

  });

}


// =======================================
// NAVIGATION
// =======================================

document.querySelectorAll(".nav-btn").forEach(btn => {

  btn.addEventListener("click", () => {

    switchView(btn.dataset.view);

  });

});
