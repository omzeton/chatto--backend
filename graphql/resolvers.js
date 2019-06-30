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
      errors.push({ message: "This email is already used!" });
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
      password: hashedPw,
      avatar: "images/no-avatar.jpg"
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
      username: user.username,
      avatar: user.avatar
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
      date: getCurrentDate(),
      avatar: messageInput.avatar,
      attachment: messageInput.attachment
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
          username: user.username,
          avatar: user.avatar
        }
      ]
    });
    const newConversation = await conversation.save();
    const link = newConversation._id.toString();
    const hashedLink = await crypto
      .createCipher("aes-256-ctr", key)
      .update(link, "utf8", "hex");
    user.conversations.push({
      cId: newConversation._id,
      url: hashedLink,
      date: getCurrentDate()
    });
    await user.save();
    return { chatroomLink: hashedLink };
  },
  connectToConversation: async function({ chatroomLink, userId }) {
    const chatroomUrl = await crypto
      .createDecipher("aes-256-ctr", key)
      .update(chatroomLink, "hex", "utf8");
    let add = true;
    const conversation = await Conv.findById(chatroomUrl);
    const user = await User.findById(userId);

    for (let i = 0; i < conversation.users.length; i++) {
      if (conversation.users[i].uId.toString() === userId) {
        add = false;
      }
    }

    if (add) {
      const newUser = {
        uId: user._id,
        username: user.username,
        avatar: user.avatar
      };
      conversation.users.push(newUser);
      await conversation.save();
    }

    let addConv = true;
    for (let y = 0; y < user.conversations.length; y++) {
      if (
        user.conversations[y].cId.toString() === conversation._id.toString()
      ) {
        addConv = false;
      }
    }
    if (addConv) {
      const newConversation = {
        cId: conversation._id,
        url: chatroomLink,
        date: getCurrentDate()
      };
      user.conversations.push(newConversation);
      await user.save();
    }

    io.getIO().emit("messages", {
      action: "join",
      post: { users: conversation.users }
    });
    return { chatroomUrl: chatroomUrl };
  },
  getPreviousConversations: async function({ userId }) {
    const user = await User.findById(userId);
    return { conversations: user.conversations };
  },
  changeUserAvatar: async function({ fileUrl, userId }) {
    const user = await User.findById(userId);
    let oldAvatar = user.avatar,
      uId = user._id;
    user.avatar = fileUrl;
    await user.save();
    const convIds = [];
    for (let c of user.conversations) {
      convIds.push(c.cId);
    }
    for (let i = 0; i < convIds.length; i++) {
      let conversation = await Conv.findById(convIds[i]);
      for (let y = 0; y < conversation.messages.length; y++) {
        if (conversation.messages[y].avatar === oldAvatar) {
          conversation.messages[y].avatar = fileUrl;
        }
      }
      for (let x = 0; x < conversation.users.length; x++) {
        if (conversation.users[x].uId.toString() === uId.toString()) {
          conversation.users[x].avatar = fileUrl;
        }
      }
      await conversation.save();
    }
    return { message: "Avatar changed successfully. " };
  },
  changePassword: async function({
    oldPassword,
    newPassword,
    repeatPassword,
    userId
  }) {
    if (
      validator.isEmpty(repeatPassword) ||
      !validator.isLength(repeatPassword, { min: 5 })
    ) {
      return { message: "Password must be 5+ characters long." };
    }
    if (newPassword !== repeatPassword) {
      return { message: "New passwords have to match." };
    }
    const user = await User.findById(userId);
    const isEqual = await bcrypt.compare(oldPassword, user.password);
    if (!isEqual) {
      return {
        message: "Incorrect old password. Please use your current one."
      };
    }
    const hashedPw = await bcrypt.hash(repeatPassword, 12);
    user.password = hashedPw;
    await user.save();
    return { message: "Password changed successfully." };
  },
  changeUsername: async function({ username, userId }) {
    if (
      validator.isEmpty(username) ||
      !validator.isLength(username, { min: 3 })
    ) {
      return { message: "Username must be at least 3+ long." };
    }
    const user = await User.findById(userId);
    user.username = username;
    await user.save();

    const convIds = [];
    for (let c of user.conversations) {
      convIds.push(c.cId);
    }
    for (let i = 0; i < convIds.length; i++) {
      let conversation = await Conv.findById(convIds[i]);
      for (let x = 0; x < conversation.users.length; x++) {
        if (conversation.users[x].uId.toString() === user._id.toString()) {
          conversation.users[x].username = username;
        }
      }
      await conversation.save();
    }
    return { message: "Username changed successfully." };
  },
  deleteAccount: async function({ userId }) {
    await User.findByIdAndDelete(userId);
    return { status: 204 };
  }
};
