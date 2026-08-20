const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  accessChat,
  createGroupChat,
  updateGroupPicture,
  fetchChats,
  sendMessage,
  allMessages,
  markRead,
  markDelivered,
} = require("../controllers/chatControllers");

const router = express.Router();

router.route("/").post(protect, accessChat).get(protect, fetchChats);

router.post("/group", protect, createGroupChat);
router.put("/:chatId/group-picture", protect, updateGroupPicture);

router.route("/messages").post(protect, sendMessage);

router.route("/messages/:chatId").get(protect, allMessages);

router.route("/messages/:chatId/read").post(protect, markRead);

router.route("/messages/:messageId/delivered").post(protect, markDelivered);

module.exports = router;
