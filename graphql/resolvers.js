const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const io = require("../socket");
const crypto = require("crypto");

const User = require("../models/user");
const Conv = require("../models/conv");

const key = "TheKey%%123";

function getCurrentDate() {
  let today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth() + 1;
  let minutes = today.getMinutes();
  let hours = today.getHours();
  let yyyy = today.getFullYear();
  let date;

  if (dd < 10) {
    dd = "0" + dd;
  }
  if (mm < 10) {
    mm = "0" + mm;
  }
  if (hours < 10) {
    hours = "0" + hours;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }

  date = yyyy + "/" + mm + "/" + dd + " " + hours + ":" + minutes;

  return date;
}

module.exports = {
  createUser: async function({ userInput }, req) {
    const errors = [];

    if (!validator.isLength(userInput.username, { min: 3 })) {
      errors.push({ message: "Username must me 3+ characters long." });
    }

    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "Invalid E-Mail." });
    }

    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      errors.push({ message: "User already exists!" });
    }

    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password must be 5+ characters long." });
    }

    if (userInput.password !== userInput.repeatPassword) {
      errors.push({ message: "Passwords have to match." });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      username: userInput.username,
      email: userInput.email,
      name: userInput.name,
      password: hashedPw
    });
    const createdUser = await user.save();
    return {
      ...createdUser._doc,
      _id: createdUser._id.toString(),
      username: createdUser.username
    };
  },
  login: async function({ username, password }) {
    const user = await User.findOne({ username: username });
    if (!user) {
      const error = new Error("User not found.");
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Incorrect password");
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username
      },
      "badzzdrow",
      { expiresIn: "1d" }
    );
    return {
      token: token,
      userId: user._id.toString(),
      username: user.username
    };
  },
  fetchConversation: async function({ conversationId }) {
    const conv = await Conv.findOne({ _id: conversationId });
    return { messages: conv.messages, users: conv.users };
  },
  createMessage: async function({ messageInput }) {
    const conv = await Conv.findOne({ _id: messageInput.conversationId });
    const newMessage = {
      uId: messageInput.userId,
      body: messageInput.body,
      date: getCurrentDate()
    };
    conv.messages.push(newMessage);
    await conv.save();
    io.getIO().emit("messages", {
      action: "create",
      post: { messages: conv.messages }
    });
    return { messages: conv.messages };
  },
  createLink: async function({ userId }) {
    const user = await User.findById(userId);
    const conversation = new Conv({
      messages: [],
      users: [
        {
          uId: user._id,
          username: user.username
        }
      ]
    });
    const newConversation = await conversation.save();
    const link = newConversation._id.toString();
    const hashedLink = await crypto
      .createCipher("aes-256-ctr", key)
      .update(link, "utf8", "hex");
    return { chatroomLink: hashedLink };
  },
  connectToConversation: async function({ chatroomLink, userId }) {
    const chatroomUrl = await crypto
      .createDecipher("aes-256-ctr", key)
      .update(chatroomLink, "hex", "utf8");
    let add = true;
    const conversation = await Conv.findById(chatroomUrl);
    for (let i = 0; i < conversation.users.length; i++) {
      if (conversation.users[i].uId.toString() === userId) {
        add = false;
      }
    }
    if (add) {
      console.log(add);
      const user = await User.findById(userId);
      const newUser = {
        uId: user._id,
        username: user.username
      };
      conversation.users.push(newUser);
      await conversation.save();
    }
    io.getIO().emit("messages", {
      action: "join",
      post: { users: conversation.users }
    });
    return { chatroomUrl: chatroomUrl };
  }
};
