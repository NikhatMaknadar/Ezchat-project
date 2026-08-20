const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/useModel");

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  const token = header.slice(7).trim();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      res.status(401);
      throw new Error("User not found");
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized, token failed");
  }
});

module.exports = { protect };
