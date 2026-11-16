// Ninety thousand Acres Team
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.database(), storage = firebase.storage();
let user, currentView = 'chat', currentRoom = 'global', selectedImage = null;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const avatar = (u = {}) => u.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(u.displayName || 'User')}`;
function toast(text) { const el=$('toast'); el.textContent=text; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),2600); }
function time(ts) { return new Date(ts || Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }

function openModal(id) { $(id).classList.remove('hidden'); $(id).classList.add('grid'); }
function closeModal(id) { $(id).classList.add('hidden'); $(id).classList.remove('grid'); }
document.addEventListener('click', e => { const close=e.target.closest('[data-close]'); if(close) closeModal(close.dataset.close); });

function setView(view) {
  currentView=view;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active-tab', b.dataset.view===view));
  renderView();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('themeColor').oninput=e=>document.documentElement.style.setProperty('--brand',e.target.value);
$('profileBtn').onclick=()=>{ $('nameInput').value=user.displayName||''; $('modalAvatar').src=avatar(user); openModal('profileModal'); };

function renderView() {
  if(currentView==='chat') renderChat();
  if(currentView==='forum') renderForum();
  if(currentView==='groups') renderGroups();
}
function shell(title, body) { $('appView').innerHTML=`<div class="glass rounded-2xl border shadow-sm"><div class="flex items-center justify-between border-b p-4"><div><h2 class="text-xl font-extrabold">${title}</h2><p class="text-sm text-slate-500">Fast, friendly community conversations</p></div></div>${body}</div>`; }

function renderChat() {
  shell('Community chat', `<div id="messages" class="scrollbar h-[58vh] space-y-3 overflow-y-auto p-4"></div><form id="messageForm" class="border-t p-3"><div class="flex items-center gap-2"><label class="cursor-pointer rounded-xl border px-3 py-3">📷<input id="imageInput" type="file" accept="image/*" class="hidden"></label><button type="button" id="emojiBtn" class="rounded-xl border px-3 py-3">😊</button><input id="messageInput" autocomplete="off" placeholder="Write a message..." class="min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none focus:border-brand"><button class="rounded-xl bg-brand px-5 py-3 font-bold text-white">Send</button></div><div id="emojiPanel" class="mt-2 hidden flex-wrap gap-2 text-xl"></div><div id="imagePreview" class="mt-2"></div></form>`);
  const emojis=['😀','😂','😍','👍','🙏','🎉','🌾','❤️','🔥','😎','👏','✨']; $('emojiPanel').innerHTML=emojis.map(x=>`<button type="button" class="emoji">${x}</button>`).join('');
  $('emojiBtn').onclick=()=>{$('emojiPanel').classList.toggle('hidden');$('emojiPanel').classList.toggle('flex')}; document.querySelectorAll('.emoji').forEach(b=>b.onclick=()=>{$('messageInput').value+=b.textContent});
  $('imageInput').onchange=e=>{selectedImage=e.target.files[0];$('imagePreview').innerHTML=selectedImage?`<span class="text-xs text-slate-500">📎 ${esc(selectedImage.name)}</span>`:''}; $('messageForm').onsubmit=sendMessage;
  listenMessages();
}
function listenMessages() { db.ref(`messages/${currentRoom}`).limitToLast(100).off().on('value', snap=>{ const box=$('messages'); if(!box)return; box.innerHTML=''; snap.forEach(x=>{const m=x.val(); const mine=m.uid===user.uid; box.innerHTML+=`<div class="message flex gap-3 ${mine?'flex-row-reverse text-right':''}"><img class="h-9 w-9 rounded-full" src="${avatar(m)}"><div class="max-w-[78%]"><div class="mb-1 text-xs text-slate-500">${esc(m.name)} · ${time(m.createdAt)}</div><div class="rounded-2xl ${mine?'bg-brand text-white':'bg-slate-100'} px-4 py-3">${m.text?`<p>${esc(m.text)}</p>`:''}${m.imageURL?`<img class="mt-2 rounded-xl" src="${m.imageURL}">`:''}</div><button data-translate="${esc(m.text||'')}" class="mt-1 text-xs text-brand">🌐 Translate to English</button><span class="translation block text-xs italic text-slate-500"></span></div></div>`}); box.scrollTop=box.scrollHeight; document.querySelectorAll('[data-translate]').forEach(b=>b.onclick=()=>translate(b)); }); }
async function translate(btn) { if(!btn.dataset.translate)return toast('There is no text to translate.'); btn.disabled=true; btn.textContent='Translating…'; try { const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(btn.dataset.translate)}&langpair=auto|en`); const j=await r.json(); btn.nextElementSibling.textContent=j.responseData?.translatedText||'Translation unavailable'; } catch(e){toast('Translation failed. Please try again.')} btn.disabled=false; btn.textContent='🌐 Translate to English'; }
async function sendMessage(e) { e.preventDefault(); const text=$('messageInput').value.trim(); if(!text&&!selectedImage)return; const data={uid:user.uid,name:user.displayName||'User',photoURL:user.photoURL||'',text,createdAt:firebase.database.ServerValue.TIMESTAMP}; if(selectedImage){const ref=storage.ref(`chat/${user.uid}/${Date.now()}_${selectedImage.name}`); await ref.put(selectedImage); data.imageURL=await ref.getDownloadURL();} await db.ref(`messages/${currentRoom}`).push(data); selectedImage=null; $('messageForm').reset(); $('imagePreview').innerHTML=''; }

function renderForum(){ shell('Community forum', `<div class="p-4"><button id="newTopic" class="rounded-xl bg-brand px-4 py-3 font-bold text-white">＋ Create topic</button></div><div id="topics" class="divide-y"></div>`); $('newTopic').onclick=()=>openModal('topicModal'); db.ref('topics').orderByChild('createdAt').on('value',s=>{let html='';s.forEach(x=>{const t=x.val();html=`<article class="p-4"><h3 class="font-bold">${esc(t.title)}</h3><p class="mt-1 text-sm text-slate-600">${esc(t.description)}</p><p class="mt-2 text-xs text-slate-400">By ${esc(t.name)} · ${time(t.createdAt)}</p><div class="mt-3"><input data-comment="${x.key}" placeholder="Write a comment and press Enter" class="w-full rounded-xl border px-3 py-2 text-sm"></div><div id="comments-${x.key}" class="mt-2 space-y-1 text-sm"></div></article>`+html; db.ref(`comments/${x.key}`).on('value',c=>{const el=$(`comments-${x.key}`);if(el)el.innerHTML=Object.values(c.val()||{}).map(v=>`<p><b>${esc(v.name)}:</b> ${esc(v.text)}</p>`).join('')})});$('topics').innerHTML=html;document.querySelectorAll('[data-comment]').forEach(i=>i.onkeydown=e=>{if(e.key==='Enter'&&i.value.trim()){db.ref(`comments/${i.dataset.comment}`).push({name:user.displayName||'User',uid:user.uid,text:i.value.trim(),createdAt:firebase.database.ServerValue.TIMESTAMP});i.value=''}})}); }
$('topicForm').onsubmit=async e=>{e.preventDefault();await db.ref('topics').push({title:$('topicTitle').value.trim(),description:$('topicDescription').value.trim(),uid:user.uid,name:user.displayName||'User',createdAt:firebase.database.ServerValue.TIMESTAMP});e.target.reset();closeModal('topicModal');toast('Topic published');};

function renderGroups(){shell('Groups',`<div class="p-4"><button id="newGroup" class="rounded-xl bg-brand px-4 py-3 font-bold text-white">＋ Create group</button><p class="mt-2 text-sm text-slate-500">Each group supports up to 40 members and has its own private chat.</p></div><div id="groups" class="divide-y"></div>`);$('newGroup').onclick=()=>openModal('groupModal');db.ref('groups').on('value',s=>{$('groups').innerHTML=Object.entries(s.val()||{}).map(([id,g])=>`<button data-group="${id}" class="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50"><span><b>${esc(g.name)}</b><small class="block text-slate-500">${esc(g.description||'')} · ${Object.keys(g.members||{}).length}/40 members</small></span><span>→</span></button>`).join('');document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{currentRoom=`group_${b.dataset.group}`;setView('chat')})});}
$('groupForm').onsubmit=async e=>{e.preventDefault();const ref=db.ref('groups').push();await ref.set({name:$('groupName').value.trim(),description:$('groupDescription').value.trim(),createdBy:user.uid,members:{[user.uid]:true},createdAt:firebase.database.ServerValue.TIMESTAMP});e.target.reset();closeModal('groupModal');toast('Group created');};

function listenOnline(){db.ref('presence').on('value',s=>{const users=Object.values(s.val()||{}).filter(x=>x.online);$('onlineCount').textContent=users.length;$('onlineUsers').innerHTML=users.map(u=>`<div class="flex items-center gap-2"><span class="relative"><img class="h-9 w-9 rounded-full" src="${avatar(u)}"><i class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"></i></span><span class="truncate text-sm font-semibold">${esc(u.displayName||'User')}</span></div>`).join('')});}
$('avatarInput').onchange=e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=()=>{$('modalAvatar').src=r.result};r.readAsDataURL(f)}};
$('profileForm').onsubmit=async e=>{e.preventDefault();const name=$('nameInput').value.trim();let photo=user.photoURL;if($('avatarInput').files[0]){const r=storage.ref(`avatars/${user.uid}`);await r.put($('avatarInput').files[0]);photo=await r.getDownloadURL()}await user.updateProfile({displayName:name,photoURL:photo});await db.ref(`presence/${user.uid}`).update({displayName:name,photoURL:photo});$('headerName').textContent=name;$('headerAvatar').src=avatar({displayName:name,photoURL:photo});closeModal('profileModal');toast('Profile updated');};

auth.onAuthStateChanged(async u=>{if(!u){await auth.signInAnonymously()}else{user=u;if(!user.displayName)await user.updateProfile({displayName:'User'});$('headerName').textContent=user.displayName;$('headerAvatar').src=avatar(user);const p=db.ref(`presence/${user.uid}`);await p.set({uid:user.uid,displayName:user.displayName,photoURL:user.photoURL||'',online:true});p.onDisconnect().update({online:false});listenOnline();renderView();}});
