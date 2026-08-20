const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, trim: true, required: true, maxlength: 4000 },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
