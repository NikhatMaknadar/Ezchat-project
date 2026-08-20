const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
      default: "",
    },

    // Separate picture for groups
    groupPic: {
      type: String,
      default: "",
    },

    isGroupChat: {
      type: Boolean,
      default: false,
    },

    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

chatSchema.index({
  users: 1,
  isGroupChat: 1,
});

module.exports = mongoose.model("Chat", chatSchema);
