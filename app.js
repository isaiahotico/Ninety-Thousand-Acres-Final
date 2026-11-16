
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  onValue,
  onChildAdded,
  runTransaction,
  serverTimestamp,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// FIREBASE CONFIGURATION
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

let currentUser = null;
let currentProfile = {};
let currentGroup = null;
let groupUnsubscribe = null;
let chatInitialized = false;

const $ = id => document.getElementById(id);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function randomUsername() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return "Acres" + Array.from(bytes, b => chars[b % chars.length]).join("");
}

async function reserveUsername(uid) {
  const existing = await get(ref(db, `users/${uid}`));

  if (existing.exists() && existing.val().username) {
    return existing.val().username;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const username = randomUsername();
    const key = username.toLowerCase();

    const result = await runTransaction(
      ref(db, `usernameIndex/${key}`),
      value => value === null ? uid : undefined
    );

    if (result.committed) {
      return username;
    }
  }

  throw new Error("Could not create a unique username. Please try again.");
}

async function initializeProfile(user) {
  const username = await reserveUsername(user.uid);
  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    await set(userRef, {
      username,
      displayName: username,
      photoURL: "",
      createdAt: serverTimestamp()
    });
  }

  const profile = (await get(userRef)).val() || {};
  currentProfile = profile;

  $("profileUsername").textContent = "@" + profile.username;
  $("displayName").value = profile.displayName || profile.username;
  $("profileImage").src = profile.photoURL ||
    "https://placehold.co/120x120?text=User";

  $("loading").classList.add("hidden-view");
  $("appContent").classList.remove("hidden-view");

  startPresence();
  startGlobalChat();
  startForum();
  startGroups();
  startOnlineUsers();
}

// AUTOMATIC ANONYMOUS AUTHENTICATION
onAuthStateChanged(auth, async user => {
  if (!user) return;

  currentUser = user;

  try {
    await initializeProfile(user);
  } catch (error) {
    console.error(error);
    $("loading").innerHTML =
      `<p class="text-red-400">Could not initialize your account: ${escapeHTML(error.message)}</p>`;
  }
});

signInAnonymously(auth).catch(error => {
  console.error(error);
  $("loading").innerHTML =
    `<p class="text-red-400">Authentication error: ${escapeHTML(error.message)}</p>`;
});

// NAVIGATION
window.showView = function(view, button) {
  document.querySelectorAll(".view").forEach(el =>
    el.classList.add("hidden-view")
  );

  $(view).classList.remove("hidden-view");

  document.querySelectorAll("nav button").forEach(el =>
    el.classList.remove("active")
  );

  if (button) button.classList.add("active");
};

// PRESENCE
function startPresence() {
  const presenceRef = ref(db, `presence/${currentUser.uid}`);

  set(presenceRef, {
    username: currentProfile.username,
    displayName: currentProfile.displayName,
    online: true,
    lastSeen: serverTimestamp()
  });

  onDisconnect(presenceRef).set({
    username: currentProfile.username,
    displayName: currentProfile.displayName,
    online: false,
    lastSeen: serverTimestamp()
  });
}

// GLOBAL CHAT
function startGlobalChat() {
  if (chatInitialized) return;
  chatInitialized = true;

  const messagesRef = ref(db, "globalChat");

  onChildAdded(messagesRef, snapshot => {
    renderMessage("chatMessages", snapshot.val(), snapshot.key);
  });
}

function renderMessage(containerId, message, id) {
  if (!message) return;

  const container = $(containerId);
  const item = document.createElement("div");

  item.className = "panel p-3 rounded-lg message";
  item.dataset.messageId = id || "";

  const own = message.uid === currentUser?.uid;
  const name = escapeHTML(message.displayName || message.username || "Member");
  const content = escapeHTML(message.text || "");
  const image = message.imageURL
    ? `<img src="${escapeHTML(message.imageURL)}" loading="lazy" class="rounded-lg mt-2 max-h-64 object-contain">`
    : "";

  item.innerHTML = `
    <div class="flex justify-between gap-2">
      <strong class="text-blue-400">${name}${own ? " (You)" : ""}</strong>
      <span class="text-xs text-gray-500">${formatTime(message.createdAt)}</span>
    </div>
    <p class="mt-2 whitespace-pre-wrap">${content}</p>
    ${image}
    <button class="text-xs text-blue-400 mt-2"
      data-translate="${escapeHTML(message.text || "")}">
      Translate to English
    </button>
  `;

  item.querySelector("[data-translate]").addEventListener("click", event => {
    translateText(event.currentTarget.dataset.translate);
  });

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

function formatTime(timestamp) {
  if (!timestamp) return "Now";

  return new Date(timestamp).toLocaleString();
}

window.sendMessage = async function() {
  const input = $("chatInput");
  const text = input.value.trim();

  if (!text || !currentUser) return;

  if (text.length > 2000) {
    alert("Message is too long.");
    return;
  }

  try {
    await push(ref(db, "globalChat"), {
      uid: currentUser.uid,
      username: currentProfile.username,
      displayName: currentProfile.displayName,
      text,
      createdAt: Date.now()
    });

    input.value = "";
  } catch (error) {
    alert("Message could not be sent: " + error.message);
  }
};

// EMOJI
window.toggleEmoji = function() {
  $("emojiPicker").classList.toggle("hidden");
};

window.addEmoji = function(emoji) {
  $("chatInput").value += emoji;
  $("chatInput").focus();
};

// TRANSLATION
window.translateText = async function(text) {
  if (!text) return;

  try {
    const url = "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) + "&langpair=auto|en";

    const response = await fetch(url);
    const data = await response.json();

    alert(data.responseData?.translatedText || "Translation unavailable.");
  } catch (error) {
    alert("Translation failed.");
  }
};

// IMAGE UPLOAD
async function uploadImage(file, folder) {
  if (!file || !currentUser) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be smaller than 5 MB.");
  }

  const path = `${folder}/${currentUser.uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const destination = storageRef(storage, path);

  await uploadBytes(destination, file);
  return await getDownloadURL(destination);
}

window.uploadChatImage = async function(input) {
  const file = input.files[0];
  if (!file) return;

  try {
    const imageURL = await uploadImage(file, "chatImages");

    await push(ref(db, "globalChat"), {
      uid: currentUser.uid,
      username: currentProfile.username,
      displayName: currentProfile.displayName,
      text: "Shared an image",
      imageURL,
      createdAt: Date.now()
    });
  } catch (error) {
    alert(error.message);
  }

  input.value = "";
};

// PROFILE
window.saveProfile = async function() {
  const displayName = $("displayName").value.trim();

  if (!displayName || displayName.length > 40) {
    alert("Enter a display name between 1 and 40 characters.");
    return;
  }

  try {
    await update(ref(db, `users/${currentUser.uid}`), {
      displayName
    });

    currentProfile.displayName = displayName;

    await update(ref(db, `presence/${currentUser.uid}`), {
      displayName
    });

    alert("Profile updated.");
  } catch (error) {
    alert(error.message);
  }
};

window.uploadProfileImage = async function(input) {
  const file = input.files[0];
  if (!file) return;

  try {
    const photoURL = await uploadImage(file, "profileImages");

    await update(ref(db, `users/${currentUser.uid}`), {
      photoURL
    });

    currentProfile.photoURL = photoURL;
    $("profileImage").src = photoURL;
    alert("Profile picture updated.");
  } catch (error) {
    alert(error.message);
  }

  input.value = "";
};

// FORUM
function startForum() {
  onValue(ref(db, "forumTopics"), snapshot => {
    const container = $("forumTopics");
    container.innerHTML = "";

    snapshot.forEach(child => {
      const topic = child.val();
      const id = child.key;

      const card = document.createElement("div");
      card.className = "panel rounded-lg p-3";

      card.innerHTML = `
        <h3 class="font-bold">${escapeHTML(topic.title)}</h3>
        <p class="text-gray-300 mt-2">${escapeHTML(topic.description)}</p>
        <p class="text-xs text-gray-500 mt-2">By ${escapeHTML(topic.displayName)}</p>
        <div id="comments-${id}" class="mt-3 space-y-2"></div>
        <div class="flex gap-2 mt-3">
          <input id="comment-${id}" class="flex-1 rounded-lg p-2"
            placeholder="Write a comment...">
          <button data-topic="${id}" class="bg-blue-600 rounded-lg px-3">Post</button>
        </div>
      `;

      card.querySelector("button").addEventListener("click", () => {
        addComment(id);
      });

      container.appendChild(card);

      onValue(ref(db, `forumTopics/${id}/comments`), comments => {
        const target = $(`comments-${id}`);
        if (!target) return;

        target.innerHTML = "";

        comments.forEach(comment => {
          const value = comment.val();
          const p = document.createElement("p");
          p.className = "text-sm border-t border-slate-700 pt-2";
          p.textContent = `${value.displayName}: ${value.text}`;
          target.appendChild(p);
        });
      });
    });
  });
}

window.createTopic = async function() {
  const title = $("topicTitle").value.trim();
  const description = $("topicDescription").value.trim();

  if (!title || !description) {
    alert("Enter a title and description.");
    return;
  }

  await push(ref(db, "forumTopics"), {
    uid: currentUser.uid,
    displayName: currentProfile.displayName,
    title: title.slice(0, 100),
    description: description.slice(0, 2000),
    createdAt: Date.now()
  });

  $("topicTitle").value = "";
  $("topicDescription").value = "";
};

window.addComment = async function(topicId) {
  const input = $(`comment-${topicId}`);
  const text = input.value.trim();

  if (!text) return;

  await push(ref(db, `forumTopics/${topicId}/comments`), {
    uid: currentUser.uid,
    displayName: currentProfile.displayName,
    text: text.slice(0, 1000),
    createdAt: Date.now()
  });

  input.value = "";
};

// GROUPS
function startGroups() {
  onValue(ref(db, "groups"), snapshot => {
    const container = $("groupList");
    container.innerHTML = "";

    snapshot.forEach(child => {
      const group = child.val();
      const id = child.key;

      const card = document.createElement("div");
      card.className = "panel p-3 rounded-lg flex justify-between items-center";

      const name = document.createElement("strong");
      name.textContent = group.name || "Group";

      const join = document.createElement("button");
      join.className = "bg-blue-600 px-4 py-2 rounded-lg";
      join.textContent = "Open";
      join.addEventListener("click", () => openGroup(id, group.name));

      card.append(name, join);
      container.appendChild(card);
    });
  });
}

window.createGroup = async function() {
  const name = $("groupName").value.trim();

  if (!name) return alert("Enter a group name.");

  const newGroup = push(ref(db, "groups"));

  await set(newGroup, {
    name: name.slice(0, 60),
    createdBy: currentUser.uid,
    createdAt: Date.now(),
    memberCount: 1,
    members: {
      [currentUser.uid]: true
    }
  });

  $("groupName").value = "";
};

async function openGroup(id, name) {
  currentGroup = id;

  try {
    const membershipRef = ref(db, `groups/${id}/members/${currentUser.uid}`);
    const membership = await get(membershipRef);

    if (!membership.exists()) {
      const result = await runTransaction(ref(db, `groups/${id}`), group => {
        if (!group) return;
        group.members ||= {};

        const members = Object.keys(group.members).filter(
          key => group.members[key]
        );

        if (members.length >= 40) return;

        group.members[currentUser.uid] = true;
        group.memberCount = Object.keys(group.members).length;
        return group;
      });

      if (!result.committed) {
        alert("This group is full (40 members maximum).");
        currentGroup = null;
        return;
      }
    }

    $("groupRoom").classList.remove("hidden-view");
    $("groupRoomTitle").textContent = name;
    $("groupList").classList.add("hidden-view");

    if (groupUnsubscribe) groupUnsubscribe();

    const messagesRef = ref(db, `groupMessages/${id}`);

    groupUnsubscribe = onChildAdded(messagesRef, snapshot => {
      renderMessage("groupMessages", snapshot.val(), snapshot.key);
    });

  } catch (error) {
    alert("Unable to open group: " + error.message);
  }
}

window.closeGroup = function() {
  if (groupUnsubscribe) groupUnsubscribe();

  groupUnsubscribe = null;
  currentGroup = null;

  $("groupMessages").innerHTML = "";
  $("groupRoom").classList.add("hidden-view");
  $("groupList").classList.remove("hidden-view");
};

window.sendGroupMessage = async function() {
  if (!currentGroup) return;

  const input = $("groupMessageInput");
  const text = input.value.trim();

  if (!text) return;

  await push(ref(db, `groupMessages/${currentGroup}`), {
    uid: currentUser.uid,
    username: currentProfile.username,
    displayName: currentProfile.displayName,
    text: text.slice(0, 2000),
    createdAt: Date.now()
  });

  input.value = "";
};

window.uploadGroupImage = async function(input) {
  if (!currentGroup) return;

  const file = input.files[0];
  if (!file) return;

  try {
    const imageURL = await uploadImage(file, "groupImages");

    await push(ref(db, `groupMessages/${currentGroup}`), {
      uid: currentUser.uid,
      username: currentProfile.username,
      displayName: currentProfile.displayName,
      text: "Shared an image",
      imageURL,
      createdAt: Date.now()
    });
  } catch (error) {
    alert(error.message);
  }

  input.value = "";
};

// ONLINE USERS
function startOnlineUsers() {
  onValue(ref(db, "presence"), snapshot => {
    const container = $("onlineUsers");
    container.innerHTML = "";

    let count = 0;

    snapshot.forEach(child => {
      const user = child.val();

      if (user.online) {
        count++;

        const item = document.createElement("div");
        item.className = "panel rounded-lg p-3";
        item.textContent = "🟢 " + (user.displayName || user.username);
        container.appendChild(item);
      }
    });

    $("onlineCount").textContent = count + " online";
  });
}

// THEME
window.changeTheme = function(color) {
  document.documentElement.style.setProperty("--theme-color", color);

  document.querySelectorAll(".bg-blue-600").forEach(element => {
    element.style.backgroundColor = color;
  });
};

// ENTER KEY SUPPORT
$("chatInput").addEventListener("keydown", event => {
  if (event.key === "Enter") window.sendMessage();
});

$("groupMessageInput").addEventListener("keydown", event => {
  if (event.key === "Enter") window.sendGroupMessage();
});
