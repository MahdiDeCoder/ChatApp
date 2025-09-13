let username = '';
let socket = null;
let currentChat = null;
const SERVER_URL = 'http://localhost:3000';
const messagesDiv = document.getElementById('messages');
const chatDiv = document.getElementById('chat');
const resultsUl = document.getElementById('results');
const notificationsDiv = document.getElementById('notifications');
const conversationsUl = document.getElementById('conversations');
const myAvatar = document.getElementById('myAvatar');
const convoListDiv = document.getElementById('convoList');
const searchDiv = document.getElementById('search');
const chatNameEl = document.getElementById('chatName');
const chatStatusEl = document.getElementById('chatStatus');
const chatAvatarEl = document.getElementById('chatAvatar');
const unread = {};

async function init() {
  const res = await fetch(`${SERVER_URL}/me`);
  if (res.status !== 200) {
    window.location = `${SERVER_URL}/login.html`;
    return;
  }
  const data = await res.json();
  username = data.username;
  if (data.avatar) myAvatar.src = SERVER_URL + data.avatar;
  socket = io(SERVER_URL, { extraHeaders: { 'x-username': username } });
  socket.on('message', onMessage);
  socket.on('status', onStatus);
  socket.on('presence', onPresence);

  const convRes = await fetch(`${SERVER_URL}/conversations`);
  const convos = await convRes.json();
  convos.forEach(addConversation);
}

function onMessage(msg) {
  if (msg.from === currentChat) {
    appendMessage(msg);
    socket.emit('read', { ids: [msg.id] });
  } else {
    if (!unread[msg.from]) unread[msg.from] = [];
    unread[msg.from].push(msg);
    showNotification(msg);
  }
}

function onStatus(update) {
  const el = document.getElementById('msg-' + update.id);
  if (el) {
    const statusSpan = el.querySelector('.status');
    if (update.status === 'delivered') statusSpan.textContent = '✔';
    if (update.status === 'read') statusSpan.textContent = '✔✔';
  }
}

function showNotification(msg) {
  addConversation(msg.from);
  let note = document.getElementById('note-' + msg.from);
  const preview = msg.type === 'text' ? msg.content : `[File] ${msg.filename}`;
  if (!note) {
    note = document.createElement('div');
    note.id = 'note-' + msg.from;
    note.className = 'notification';
    note.onclick = () => startChat(msg.from);
    notificationsDiv.appendChild(note);
  }
  note.textContent = `New message from ${msg.from}: ${preview}`;
}

function addConversation(user) {
  if (document.getElementById('conv-' + user)) return;
  const li = document.createElement('li');
  li.id = 'conv-' + user;
  li.textContent = user;
  li.onclick = () => startChat(user);
  conversationsUl.appendChild(li);
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'message ' + (msg.from === username ? 'sent' : 'received');
  div.id = 'msg-' + msg.id;
  if (msg.type === 'text') {
    div.innerHTML = `<span>${msg.content}</span>`;
  } else if (msg.type === 'file') {
    const fileSrc = msg.file && !msg.file.startsWith('data:') ? `${SERVER_URL}${msg.file}` : msg.file;
    if (msg.fileType && msg.fileType.startsWith('image/')) {
      div.innerHTML = `<img src="${fileSrc}" alt="${msg.filename}" />`;
    } else {
      div.innerHTML = `<a href="${fileSrc}" target="_blank">${msg.filename}</a>`;
    }
  }
  if (msg.from === username) {
    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = msg.status === 'read' ? '✔✔' : msg.status === 'delivered' ? '✔' : '';
    div.appendChild(status);
  }
  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  div.appendChild(time);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function loadMessages(user) {
  messagesDiv.innerHTML = '';
  const res = await fetch(`${SERVER_URL}/messages/${user}`);
  const msgs = await res.json();
  msgs.forEach(m => appendMessage(m));
  const unreadIds = msgs.filter(m => m.to === username && m.status !== 'read').map(m => m.id);
  if (unreadIds.length) socket.emit('read', { ids: unreadIds });
}

document.getElementById('searchBtn').onclick = async () => {
  const val = document.getElementById('searchBox').value;
  const res = await fetch(`${SERVER_URL}/users?search=` + encodeURIComponent(val));
  const users = await res.json();
  resultsUl.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;
    li.onclick = () => startChat(u);
    resultsUl.appendChild(li);
  });
};

function startChat(user) {
  addConversation(user);
  currentChat = user;
  chatDiv.classList.remove('hidden');
  convoListDiv.classList.add('hidden');
  searchDiv.classList.add('hidden');
  chatNameEl.textContent = user;
  const note = document.getElementById('note-' + user);
  if (note) notificationsDiv.removeChild(note);
  delete unread[user];
  loadMessages(user);
  loadProfileForChat(user);
}

document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('messageInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  if (!currentChat) return;
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (content) {
    const msg = { id: Date.now().toString(), from: username, to: currentChat, type: 'text', content, timestamp: Date.now(), status: '' };
    appendMessage(msg);
    socket.emit('message', { to: currentChat, content, type: 'text' });
    input.value = '';
  }
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result.split(',')[1];
      const msg = { id: Date.now().toString(), from: username, to: currentChat, type: 'file', filename: file.name, fileType: file.type, file: e.target.result, timestamp: Date.now(), status: '' };
      appendMessage(msg);
      socket.emit('message', { to: currentChat, type: 'file', filename: file.name, fileType: file.type, fileData: base64 });
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  }
}

document.getElementById('emojiBtn').onclick = () => {
  const panel = document.getElementById('emojiPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

document.querySelectorAll('.emoji').forEach(e => {
  e.onclick = () => {
    const input = document.getElementById('messageInput');
    input.value += e.textContent;
    document.getElementById('emojiPanel').style.display = 'none';
    input.focus();
  };
});

chatNameEl.onclick = () => { if (currentChat) showProfile(currentChat); };
chatAvatarEl.onclick = () => { if (currentChat) showProfile(currentChat); };
document.getElementById('backBtn').onclick = () => {
  chatDiv.classList.add('hidden');
  convoListDiv.classList.remove('hidden');
  searchDiv.classList.remove('hidden');
  currentChat = null;
};

document.getElementById('closeProfile').onclick = () => {
  document.getElementById('profileOverlay').style.display = 'none';
};

async function showProfile(user) {
  const res = await fetch(`${SERVER_URL}/profile/${user}`);
  if (res.status !== 200) return;
  const data = await res.json();
  document.getElementById('overlayName').textContent = data.username;
  document.getElementById('overlayAbout').textContent = data.about || '';
  document.getElementById('overlayCreated').textContent = 'Joined: ' + new Date(data.createdAt).toLocaleString();
  if (data.avatar) document.getElementById('overlayAvatar').src = SERVER_URL + data.avatar;
  else document.getElementById('overlayAvatar').src = '';
  document.getElementById('profileOverlay').style.display = 'flex';
}

async function loadProfileForChat(user) {
  const res = await fetch(`${SERVER_URL}/profile/${user}`);
  if (res.status !== 200) return;
  const data = await res.json();
  if (data.avatar) chatAvatarEl.src = SERVER_URL + data.avatar; else chatAvatarEl.src = '';
  updateStatusText(data);
}

function onPresence(p) {
  if (p.username === currentChat) updateStatusText(p);
}

function updateStatusText(p) {
  if (!chatStatusEl) return;
  if (p.online) chatStatusEl.textContent = 'Online';
  else if (p.lastSeen) chatStatusEl.textContent = 'Last seen ' + new Date(p.lastSeen).toLocaleString();
  else chatStatusEl.textContent = '';
}

init();
