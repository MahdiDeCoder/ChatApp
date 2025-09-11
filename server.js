const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));

const readJSON = (file) => JSON.parse(fs.readFileSync(file));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));

// Redirect root to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Helper to ensure user is logged in
function requireLogin(req, res, next) {
  if (!req.session.username) return res.redirect('/login.html');
  next();
}

// Serve chat page only if logged in
app.get('/chat.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});
// Assets for login page
app.use(express.static(path.join(__dirname, 'public')));
// Protect uploaded files
app.use('/uploads', requireLogin, express.static(UPLOAD_DIR));

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send('Username required');
  req.session.username = username;
  const users = readJSON(USERS_FILE);
  if (!users.includes(username)) {
    users.push(username);
    writeJSON(USERS_FILE, users);
  }
  res.redirect('/chat.html');
});

app.get('/me', (req, res) => {
  if (!req.session.username) return res.status(401).json({});
  res.json({ username: req.session.username });
});

app.get('/users', requireLogin, (req, res) => {
  const search = (req.query.search || '').toLowerCase();
  const users = readJSON(USERS_FILE).filter(u => u.toLowerCase().includes(search) && u !== req.session.username);
  res.json(users);
});

app.get('/messages/:withUser', requireLogin, (req, res) => {
  const { withUser } = req.params;
  const username = req.session.username;
  const messages = readJSON(MESSAGES_FILE).filter(m => (m.from === username && m.to === withUser) || (m.from === withUser && m.to === username));
  res.json(messages);
});

app.get('/conversations', requireLogin, (req, res) => {
  const username = req.session.username;
  const messages = readJSON(MESSAGES_FILE);
  const users = new Set();
  messages.forEach(m => {
    if (m.from === username) users.add(m.to);
    if (m.to === username) users.add(m.from);
  });
  res.json(Array.from(users));
});

const userSockets = new Map(); // username -> socket

io.use((socket, next) => {
  const req = socket.request;
  const sess = req.headers.cookie;
  // Simple session extraction
  if (!sess) return next(new Error('No session'));
  const match = /connect\.sid=s%3A([^\.]+)/.exec(sess);
  if (!match) return next(new Error('Bad session'));
  next();
});

io.on('connection', socket => {
  const username = socket.handshake.headers['x-username'];
  if (!username) {
    socket.disconnect();
    return;
  }
  userSockets.set(username, socket);

  // Mark any offline messages as delivered upon connection
  const offline = readJSON(MESSAGES_FILE);
  let offlineChanged = false;
  offline.forEach(m => {
    if (m.to === username && m.status === 'sent') {
      m.status = 'delivered';
      offlineChanged = true;
      const fromSocket = userSockets.get(m.from);
      if (fromSocket) fromSocket.emit('status', { id: m.id, status: 'delivered' });
    }
  });
  if (offlineChanged) writeJSON(MESSAGES_FILE, offline);

  socket.on('disconnect', () => {
    userSockets.delete(username);
  });

  socket.on('message', data => {
    const { to, content, type, filename, fileData, fileType } = data;
    const from = username;
    let filePath = null;
    if (type === 'file' && fileData) {
      const safeName = Date.now() + '_' + filename;
      filePath = path.join(UPLOAD_DIR, safeName);
      fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
    }
    const id = uuidv4();
    const msg = { id, from, to, type, content, filename, fileType, file: filePath ? '/uploads/' + path.basename(filePath) : null, timestamp: Date.now(), status: 'sent' };
    const messages = readJSON(MESSAGES_FILE);
    messages.push(msg);
    writeJSON(MESSAGES_FILE, messages);

    const toSocket = userSockets.get(to);
    if (toSocket) {
      msg.status = 'delivered';
      writeJSON(MESSAGES_FILE, messages);
      toSocket.emit('message', msg);
      socket.emit('status', { id, status: 'delivered' });
    }
  });

  socket.on('read', data => {
    const { ids } = data; // array of message ids
    const messages = readJSON(MESSAGES_FILE);
    let changed = false;
    ids.forEach(id => {
      const msg = messages.find(m => m.id === id);
      if (msg && msg.status !== 'read') {
        msg.status = 'read';
        changed = true;
        const fromSocket = userSockets.get(msg.from);
        if (fromSocket) fromSocket.emit('status', { id, status: 'read' });
      }
    });
    if (changed) writeJSON(MESSAGES_FILE, messages);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
server.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
