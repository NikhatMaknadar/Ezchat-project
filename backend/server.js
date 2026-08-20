const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const User = require("./models/useModel");

const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();

const app = express();

const server = http.createServer(app);

/* =========================================================
   SOCKET.IO
   ========================================================= */

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

app.use(cors());

app.use(
  express.json({
    limit: "1mb",
  }),
);

/* =========================================================
   API
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    message: "Talk-A-Tive API is running",
  });
});

app.use("/api/user", userRoutes);

app.use("/api/chat", chatRoutes);

/* =========================================================
   ONLINE USERS
   ========================================================= */

const onlineUsers = new Map();

/* =========================================================
   SOCKET AUTHENTICATION
   ========================================================= */

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Not authorized"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;

    next();
  } catch {
    next(new Error("Not authorized"));
  }
};

io.use(authenticateSocket);

/* =========================================================
   SOCKET CONNECTION
   ========================================================= */

io.on("connection", async (socket) => {
  const userId = socket.user._id.toString();

  /*
      IMPORTANT:

      Every connected user gets
      their own private room.

      Example:

      user:65abc123

      This allows the server to send
      a new-message notification even
      when that chat isn't open.
    */

  socket.join(`user:${userId}`);

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }

  onlineUsers.get(userId).add(socket.id);

  await User.findByIdAndUpdate(userId, {
    isOnline: true,
  });

  io.emit("presence", {
    userId,
    isOnline: true,
    lastSeen: null,
  });

  /* =====================================================
       JOIN CHAT
       ===================================================== */

  socket.on("join chat", (chatId) => {
    if (chatId) {
      socket.join(`chat:${chatId}`);
    }
  });

  /* =====================================================
       LEAVE CHAT
       ===================================================== */

  socket.on("leave chat", (chatId) => {
    if (chatId) {
      socket.leave(`chat:${chatId}`);
    }
  });

  /* =====================================================
       TYPING
       ===================================================== */

  socket.on("typing", (chatId) => {
    if (chatId) {
      socket.to(`chat:${chatId}`).emit("typing", {
        userId,
      });
    }
  });

  /* =====================================================
       STOP TYPING
       ===================================================== */

  socket.on("stop typing", (chatId) => {
    if (chatId) {
      socket.to(`chat:${chatId}`).emit("stop typing", {
        userId,
      });
    }
  });

  /* =====================================================
       DISCONNECT
       ===================================================== */

  socket.on("disconnect", async () => {
    const set = onlineUsers.get(userId);

    if (set) {
      set.delete(socket.id);

      /*
            User may have multiple
            browser tabs/devices.

            Only mark offline when
            ALL sockets are gone.
          */

      if (set.size === 0) {
        onlineUsers.delete(userId);

        const lastSeen = new Date();

        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        });

        io.emit("presence", {
          userId,
          isOnline: false,
          lastSeen,
        });
      }
    }
  });
});

/* =========================================================
   ERROR HANDLING
   ========================================================= */

app.use(notFound);

app.use(errorHandler);

/* =========================================================
   START SERVER
   ========================================================= */

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server started on PORT ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`MongoDB connection error: ${error.message}`);

    process.exit(1);
  });
