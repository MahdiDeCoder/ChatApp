# ChatApp

Simple chat application with login, user search, text and file messaging, emojis, and delivery/read receipts. Built with Express and Socket.io.

## Features
- Login with username
- Login required to access chat and uploads
- Search users by username
- Real-time chat with text, images/files, and emojis
- Real-time delivery (✔) and read (✔✔) receipts
- Live notifications for incoming messages
- Conversation list showing past contacts
- Online status with last-seen timestamps
- Timestamps under each message
- User profiles with avatar and bio
- Profile picture shown in chat and clickable profiles to view details
- Persistent storage of users and messages

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. The server binds to `localhost:3000`. Open <http://localhost:3000/> in a browser to use the app (you'll be redirected to the login page).
4. Login with a username, optionally update your profile (click your avatar), search for another user, and start chatting.

If you need to point the client to a different server, update `SERVER_URL` in `public/main.js` and the asset URLs in `public/*.html`.

Uploaded files are saved in the `uploads` directory.
