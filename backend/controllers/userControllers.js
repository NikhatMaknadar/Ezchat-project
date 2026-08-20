const asyncHandler = require("express-async-handler");

const User = require("../models/useModel");
const generateToken = require("../config/generateToken");

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  pic: user.pic,
  isOnline: !!user.isOnline,
  lastSeen: user.lastSeen,
  token: generateToken(user._id),
});

/* =========================================================
   REGISTER
   ========================================================= */

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, pic } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400);
    throw new Error("Please enter all fields");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const exists = await User.findOne({
    email: normalizedEmail,
  });

  if (exists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    pic: pic || undefined,
  });

  res.status(201).json(publicUser(user));
});

/* =========================================================
   LOGIN
   ========================================================= */

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json(publicUser(user));
});

/* =========================================================
   SEARCH USERS
   ========================================================= */

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const allUsers = asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").trim();

  if (!search) {
    return res.json([]);
  }

  const safe = escapeRegex(search);

  const users = await User.find({
    _id: { $ne: req.user._id },

    $or: [
      {
        name: {
          $regex: safe,
          $options: "i",
        },
      },
      {
        email: {
          $regex: safe,
          $options: "i",
        },
      },
    ],
  })
    .select("_id name email pic isOnline lastSeen")
    .limit(20);

  res.json(users);
});

/* =========================================================
   GET PROFILE
   ========================================================= */

const getProfile = asyncHandler(async (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    pic: req.user.pic,
    isOnline: req.user.isOnline,
    lastSeen: req.user.lastSeen,
  });
});

/* =========================================================
   UPDATE PROFILE
   ========================================================= */

const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, pic } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  /* -------------------------
     NAME
  ------------------------- */

  if (name !== undefined) {
    const trimmedName = String(name).trim();

    if (!trimmedName) {
      res.status(400);
      throw new Error("Name cannot be empty");
    }

    if (trimmedName.length > 80) {
      res.status(400);
      throw new Error("Name cannot exceed 80 characters");
    }

    user.name = trimmedName;
  }

  /* -------------------------
     EMAIL
  ------------------------- */

  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!normalizedEmail) {
      res.status(400);
      throw new Error("Email cannot be empty");
    }

    const emailExists = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });

    if (emailExists) {
      res.status(400);
      throw new Error("Email is already in use");
    }

    user.email = normalizedEmail;
  }

  /* -------------------------
     PROFILE PICTURE
  ------------------------- */

  if (pic !== undefined) {
    user.pic = pic || user.pic;
  }

  /* -------------------------
     PASSWORD
  ------------------------- */

  if (password) {
    if (password.length < 6) {
      res.status(400);
      throw new Error("New password must be at least 6 characters");
    }

    if (password !== confirmPassword) {
      res.status(400);
      throw new Error("New password and confirm password do not match");
    }

    /*
      IMPORTANT:

      We assign the plain password here.

      Your existing User model's pre-save hook
      will automatically hash it.

      So DO NOT bcrypt.hash() here.
    */

    user.password = password;
  }

  await user.save();

  /*
    Return a fresh JWT.

    This also keeps the user's existing
    authentication valid after editing
    the profile.
  */

  res.json(publicUser(user));
});

module.exports = {
  registerUser,
  authUser,
  allUsers,
  getProfile,
  updateProfile,
};
