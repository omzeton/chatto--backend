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
      avatar: "images/no-avatar.jpg",
      registryDate: getCurrentDate(),
      contacts: []
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
  createMessage: async function({ messageInput }) {
    // Find stream where there are both ids
    const allConversations = await Conv.find();
    let currentUserPresent = false,
      otherUserPresent = false,
      streamId;
    for (let i = 0; i < allConversations.length; i++) {
      for (let u of allConversations[i].users) {
        if (u.uId.toString() === messageInput.otherId) {
          otherUserPresent = true;
        }
        if (u.uId.toString() === messageInput.ownId) {
          currentUserPresent = true;
        }
      }
      if (currentUserPresent && otherUserPresent) {
        streamId = allConversations[i]._id.toString();
      }
    }

    console.log(streamId);
    const conv = await Conv.findById(streamId);
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
  },
  connectToStream: async function({ otherId, ownId, useFirstContact }) {
    let globalOtherId = otherId;
    if (useFirstContact) {
      const user = await User.findById(ownId);
      globalOtherId = user.contacts[0].uId;
    }
    // Add user to contacts
    if (!useFirstContact) {
      const currentUser = await User.findById(ownId);
      let addNewContact = true;
      for (let c of currentUser.contacts) {
        if (c.uId.toString() === globalOtherId) {
          addNewContact = false;
        }
      }
      const otherUser = await User.findById(globalOtherId);

      if (addNewContact) {
        const newContactItem = {
          uId: globalOtherId,
          avatar: otherUser.avatar,
          username: otherUser.username
        };
        currentUser.contacts.push(newContactItem);
        await currentUser.save();

        const newContactItemOther = {
          uId: ownId,
          avatar: currentUser.avatar,
          username: currentUser.username
        };
        otherUser.contacts.push(newContactItemOther);
        await otherUser.save();
      }
    }

    // Check if the conversation already exsists
    // Create new conversation
    const allConversations = await Conv.find();
    let createNewStream = true,
      currentUserExists = false,
      otherUserExists = false,
      convId;
    for (let i = 0; i < allConversations.length; i++) {
      for (let u of allConversations[i].users) {
        if (u.uId.toString() === ownId) {
          currentUserExists = true;
        }
        if (u.uId.toString() === globalOtherId.toString()) {
          otherUserExists = true;
        }
      }
      if (otherUserExists && currentUserExists) {
        convId = allConversations[i]._id.toString();
      }
    }
    if (otherUserExists && currentUserExists) {
      createNewStream = false;
    }

    if (useFirstContact) {
      createNewStream = false;
    }

    if (createNewStream) {
      const newConversationStream = new Conv({
        messages: [],
        users: [
          {
            uId: globalOtherId,
            username: otherUser.username,
            avatar: otherUser.avatar
          },
          {
            uId: ownId,
            username: currentUser.username,
            avatar: currentUser.avatar
          }
        ]
      });
      const conv = await newConversationStream.save();
      io.getIO().emit("messages", {
        action: "join",
        post: { users: conv.users }
      });
      return { messages: conv.messages, users: conv.users };
    } else {
      const conv = await Conv.findById(convId);
      io.getIO().emit("messages", {
        action: "join",
        post: { users: conv.users }
      });
      return { messages: conv.messages, users: conv.users };
    }
  },
  fetchAllUsers: async function({ userId }) {
    const users = await User.find();
    return { users: users };
  },
  fetchContactList: async function({ userId }) {
    const user = await User.findById(userId);
    return { contacts: user.contacts };
  }
};
