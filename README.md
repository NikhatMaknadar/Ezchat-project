# Talk-A-Tive

A MERN-style WhatsApp-inspired private chat application.

## Features
- JWT registration/login/logout
- Protected user and chat APIs
- MongoDB chat and message persistence
- User search
- One-to-one conversations
- Real-time messages with Socket.IO
- Online/offline and last-seen presence
- Typing indicator
- Delivered/read message ticks
- Responsive WhatsApp-inspired interface

## Run

### Backend
Create `backend/.env` with your own values:
`MONGO_URI=...`
`JWT_SECRET=...`
`PORT=5000`

Then:
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Frontend runs on http://localhost:3000 and proxies API requests to port 5000.
