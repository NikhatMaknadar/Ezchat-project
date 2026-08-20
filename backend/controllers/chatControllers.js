const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Chat = require("../models/chatModel");
const User = require("../models/useModel");
const Message = require("../models/messageModel");

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const populateChat = (query) =>
  query
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate({
      path: "latestMessage",
      populate: {
        path: "sender",
        select: "name email pic isOnline lastSeen",
      },
    });

/* =========================================================
   SEND SOCKET EVENT TO CHAT
   ========================================================= */

const emitToChat = (req, event, chatId, payload) => {
  const io = req.app.get("io");

  if (io) {
    io.to(`chat:${chatId}`).emit(event, payload);
  }
};

/* =========================================================
   SEND SOCKET EVENT TO USERS OF CHAT
   ========================================================= */

const emitToChatUsers = (req, event, chat, payload) => {
  const io = req.app.get("io");

  if (!io) return;

  chat.users.forEach((userId) => {
    io.to(`user:${userId.toString()}`).emit(event, payload);
  });
};

/* =========================================================
   CREATE GROUP CHAT
   ========================================================= */

const createGroupChat = asyncHandler(async (req, res) => {
  const { name, userIds, groupPic } = req.body;

  if (!name?.trim() || !Array.isArray(userIds) || userIds.length < 1) {
    res.status(400);
    throw new Error("Group name and at least one other user are required");
  }

  const uniqueIds = [
    ...new Set(userIds.map(String).filter((id) => validId(id))),
  ];

  if (!uniqueIds.length || uniqueIds.includes(req.user._id.toString())) {
    res.status(400);
    throw new Error("Please select valid group members other than yourself");
  }

  const members = await User.find({
    _id: { $in: uniqueIds },
  }).select("_id");

  if (members.length !== uniqueIds.length) {
    res.status(400);
    throw new Error("One or more selected users do not exist");
  }

  const chat = await Chat.create({
    chatName: name.trim(),

    // Separate group picture
    groupPic: groupPic || "",

    isGroupChat: true,

    users: [req.user._id, ...members.map((member) => member._id)],

    groupAdmin: req.user._id,
  });

  const populated = await populateChat(Chat.findById(chat._id));

  res.status(201).json(populated);
});
const updateGroupPicture = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { groupPic } = req.body;

  if (!validId(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  if (!groupPic) {
    res.status(400);
    throw new Error("Group picture is required");
  }

  const chat = await Chat.findById(chatId);

  if (!chat) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (!chat.isGroupChat) {
    res.status(400);
    throw new Error("This is not a group chat");
  }

  // Only group admin can change group picture
  if (String(chat.groupAdmin) !== String(req.user._id)) {
    res.status(403);
    throw new Error("Only the group admin can change the group picture");
  }

  chat.groupPic = groupPic;

  await chat.save();

  const updatedChat = await populateChat(Chat.findById(chat._id));

  // Update everyone in the group immediately
  const io = req.app.get("io");

  if (io) {
    io.to(`chat:${chatId}`).emit("group picture updated", updatedChat);
  }

  res.json(updatedChat);
});
/* =========================================================
   ACCESS / CREATE ONE-TO-ONE CHAT
   ========================================================= */

const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId || !validId(userId)) {
    res.status(400);
    throw new Error("A valid userId is required");
  }

  if (userId.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("You cannot start a chat with yourself");
  }

  const otherUser = await User.findById(userId);

  if (!otherUser) {
    res.status(404);
    throw new Error("User not found");
  }

  let chat = await populateChat(
    Chat.findOne({
      isGroupChat: false,
      users: {
        $all: [req.user._id, userId],
        $size: 2,
      },
    }),
  );

  if (chat) {
    return res.json(chat);
  }

  chat = await Chat.create({
    users: [req.user._id, userId],
    isGroupChat: false,
  });

  chat = await populateChat(Chat.findById(chat._id));

  res.status(201).json(chat);
});

/* =========================================================
   FETCH USER CHATS + UNREAD COUNT
   ========================================================= */

const fetchChats = asyncHandler(async (req, res) => {
  let chats = await populateChat(
    Chat.find({
      users: req.user._id,
    }).sort({
      updatedAt: -1,
    }),
  );

  const chatsWithUnreadCount = await Promise.all(
    chats.map(async (chat) => {
      if (!chat.isGroupChat) {
        const other = chat.users.find(
          (user) => user._id.toString() !== req.user._id.toString(),
        );

        chat.chatName = other?.name || "Chat";
      }

      /*
            Unread means:

            - message belongs to this chat
            - message was NOT sent by me
            - I haven't read it yet
          */

      const unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: {
          $ne: req.user._id,
        },
        readBy: {
          $ne: req.user._id,
        },
      });

      return {
        ...chat.toObject(),
        unreadCount,
      };
    }),
  );

  res.json(chatsWithUnreadCount);
});

/* =========================================================
   SEND MESSAGE
   ========================================================= */

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content?.trim() || !chatId || !validId(chatId)) {
    res.status(400);
    throw new Error("content and a valid chatId are required");
  }

  const chat = await Chat.findById(chatId);

  if (
    !chat ||
    !chat.users.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(403);
    throw new Error("You do not have access to this chat");
  }

  /*
      Sender is automatically:

      deliveredTo = sender
      readBy      = sender

      Receiver will be added when
      their browser receives the message.
    */

  let message = await Message.create({
    sender: req.user._id,
    content: content.trim(),
    chat: chatId,
    deliveredTo: [req.user._id],
    readBy: [req.user._id],
  });

  await Chat.findByIdAndUpdate(chatId, {
    latestMessage: message._id,
    updatedAt: new Date(),
  });

  message = await Message.findById(message._id)
    .populate("sender", "name email pic isOnline lastSeen")
    .populate("chat");

  /*
      IMPORTANT:

      Send to every user in this chat,
      even if they haven't opened
      the chat.

      This is what makes the unread
      notification work.
    */

  emitToChatUsers(req, "message received", chat, message);

  res.status(201).json(message);
});

/* =========================================================
   GET ALL MESSAGES
   ========================================================= */

const allMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!validId(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);

  if (
    !chat ||
    !chat.users.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(403);
    throw new Error("You do not have access to this chat");
  }

  /*
      Opening the chat means
      messages are delivered.
    */

  await Message.updateMany(
    {
      chat: chatId,
      sender: {
        $ne: req.user._id,
      },
      deliveredTo: {
        $ne: req.user._id,
      },
    },
    {
      $addToSet: {
        deliveredTo: req.user._id,
      },
    },
  );

  const messages = await Message.find({
    chat: chatId,
  })
    .populate("sender", "name email pic isOnline lastSeen")
    .sort({
      createdAt: 1,
    });

  res.json(messages);
});

/* =========================================================
   MARK MESSAGES AS READ
   ========================================================= */

const markRead = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!validId(chatId)) {
    res.status(400);
    throw new Error("Invalid chatId");
  }

  const chat = await Chat.findById(chatId);

  if (
    !chat ||
    !chat.users.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(403);
    throw new Error("You do not have access to this chat");
  }

  const messages = await Message.find({
    chat: chatId,
    sender: {
      $ne: req.user._id,
    },
  }).select("_id sender");

  await Message.updateMany(
    {
      chat: chatId,
      sender: {
        $ne: req.user._id,
      },
    },
    {
      $addToSet: {
        deliveredTo: req.user._id,
        readBy: req.user._id,
      },
    },
  );

  emitToChat(req, "messages read", chatId, {
    chatId,
    userId: req.user._id.toString(),
    messageIds: messages.map((message) => message._id.toString()),
  });

  res.json({
    success: true,
  });
});

/* =========================================================
   MARK MESSAGE AS DELIVERED
   ========================================================= */

const markDelivered = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!validId(messageId)) {
    res.status(400);
    throw new Error("Invalid messageId");
  }

  const message = await Message.findById(messageId);

  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }

  const chat = await Chat.findById(message.chat);

  if (
    !chat ||
    !chat.users.some((id) => id.toString() === req.user._id.toString())
  ) {
    res.status(403);
    throw new Error("You do not have access to this message");
  }

  if (message.sender.toString() !== req.user._id.toString()) {
    await Message.findByIdAndUpdate(messageId, {
      $addToSet: {
        deliveredTo: req.user._id,
      },
    });

    emitToChat(req, "message delivered", message.chat.toString(), {
      messageId,
      userId: req.user._id.toString(),
    });
  }

  res.json({
    success: true,
  });
});

/* =========================================================
   EXPORT
   ========================================================= */

module.exports = {
  accessChat,
  createGroupChat,
  updateGroupPicture,
  fetchChats,
  sendMessage,
  allMessages,
  markRead,
  markDelivered,
};
