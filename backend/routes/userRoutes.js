const express = require("express");

const {
  registerUser,
  authUser,
  allUsers,
  getProfile,
  updateProfile,
} = require("../controllers/userControllers");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

/* Register */
router.post("/", registerUser);

/* Login */
router.post("/login", authUser);

/* Search users */
router.get("/", protect, allUsers);

/* Current profile */
router.get("/profile", protect, getProfile);

/* Edit profile */
router.put("/profile", protect, updateProfile);

module.exports = router;
