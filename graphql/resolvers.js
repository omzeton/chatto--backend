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
    let useFirstContact = messageInput.otherId === ":id" ? true : false;
    let otherUserId = messageInput.otherId;
    let currentUser = await User.findById(messageInput.ownId);

    // If no id was specified use first contact
    if (useFirstContact) {
      otherUserId = currentUser.contacts[0].uId;
    }
    console.log(otherUserId);
    let otherUser = await User.findById(otherUserId);

    console.log(otherUser);
    // Find stream where there are both ids
    const allConversations = await Conv.find();
    let currentUserPresent = false,
      otherUserPresent = false,
      streamId;
    for (let i = 0; i < allConversations.length; i++) {
      for (let u of allConversations[i].users) {
        if (u.uId.toString() === otherUser._id.toString()) {
          otherUserPresent = true;
        }
        if (u.uId.toString() === currentUser._id.toString()) {
          currentUserPresent = true;
        }
      }
      if (currentUserPresent && otherUserPresent) {
        streamId = allConversations[i]._id.toString();
      }
    }

    const conv = await Conv.findById(streamId);
    const newMessage = {
      uId: currentUser._id,
      body: messageInput.body,
      date: getCurrentDate(),
      avatar: currentUser.avatar,
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
    user.avatar = fileUrl;
    await user.save();

    // Change avatars in all contacts
    const allUsers = await User.find();

    for (let i = 0; i < allUsers.length; i++) {
      for (let c of allUsers[i].contacts) {
        if (c.uId.toString() === user._id.toString()) {
          c.avatar = fileUrl;
        }
      }
      await allUsers[i].save();
    }

    // Change avatars in message streams
    const allConversations = await Conv.find();

    for (let i = 0; i < allConversations.length; i++) {
      // In users
      for (u of allConversations[i].users) {
        if (u.uId.toString() === user._id.toString()) {
          u.avatar = fileUrl;
        }
      }
      // In messages
      for (m of allConversations[i].messages) {
        if (m.uId.toString() === user._id.toString()) {
          m.avatar = fileUrl;
        }
      }
      await allConversations[i].save();
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

    // Change username in all contacts
    const allUsers = await User.find();

    for (let i = 0; i < allUsers.length; i++) {
      for (let c of allUsers[i].contacts) {
        if (c.uId.toString() === user._id.toString()) {
          c.username = username;
        }
      }
      await allUsers[i].save();
    }

    // Change avatars in message streams
    const allConversations = await Conv.find();

    for (let i = 0; i < allConversations.length; i++) {
      // In users
      for (u of allConversations[i].users) {
        if (u.uId.toString() === user._id.toString()) {
          u.username = username;
        }
      }
      // In messages
      for (m of allConversations[i].messages) {
        if (m.uId.toString() === user._id.toString()) {
          m.username = username;
        }
      }
      await allConversations[i].save();
    }
    return { message: "Username changed successfully." };
  },
  deleteAccount: async function({ userId }) {
    // Delete account
    await User.findByIdAndDelete(userId);
    // Delete conversations
    const allConversations = await Conv.find();
    const conversationsToDelete = [];
    for (let i = 0; i < allConversations.length; i++) {
      for (let u of allConversations[i].users) {
        if (u.uId.toString() === userId.toString()) {
          conversationsToDelete.push(allConversations[i]._id.toString());
        }
      }
    }
    for (let c of conversationsToDelete) {
      await Conv.findByIdAndDelete(c);
    }
    // Delete user from everybody's contacts
    const allUsers = await User.find();
    for (let i = 0; i < allUsers.length; i++) {
      allUsers[i].contacts = allUsers[i].contacts.filter(
        value => value.uId.toString() !== userId.toString()
      );
      await allUsers[i].save();
    }
    return { status: 204 };
  },
  connectToStream: async function({ otherId, ownId }) {
    let useFirstContact = otherId === ":id" ? true : false;
    let otherUserId = otherId;
    let currentUser = await User.findById(ownId);

    // If no id was specified use first contact
    if (useFirstContact) {
      otherUserId = currentUser.contacts[0].uId;
    }
    let otherUser = await User.findById(otherUserId);

    // Add other user to current contacts
    let addNewContact = true;
    for (let c of currentUser.contacts) {
      if (c.uId.toString() === otherUser._id.toString()) {
        addNewContact = false;
      }
    }

    if (addNewContact) {
      // Add other user to current contacts
      const newContactItem = {
        uId: otherUser._id,
        avatar: otherUser.avatar,
        username: otherUser.username
      };
      currentUser.contacts.push(newContactItem);
      currentUser = await currentUser.save();
      // Add current user to other contacts
      const newContactItemOther = {
        uId: currentUser._id,
        avatar: currentUser.avatar,
        username: currentUser.username
      };
      otherUser.contacts.push(newContactItemOther);
      otherUser = await otherUser.save();
    }

    // Check if the conversation already exsists
    // Create new conversation
    const allConversations = await Conv.find();
    let streamExists = false,
      currentUserExists = false,
      otherUserExists = false,
      existingConvId;

    for (let i = 0; i < allConversations.length; i++) {
      for (let u of allConversations[i].users) {
        if (u.uId.toString() === currentUser._id.toString()) {
          currentUserExists = true;
        }
        if (u.uId.toString() === otherUser._id.toString()) {
          otherUserExists = true;
        }
      }
      if (otherUserExists && currentUserExists) {
        existingConvId = allConversations[i]._id.toString();
      }
      currentUserExists = false;
      otherUserExists = false;
    }

    if (existingConvId) {
      streamExists = true;
    }

    if (allConversations === undefined || allConversations.length == 0) {
      streamExists = false;
    }

    let conv;

    if (!streamExists) {
      const newConversationStream = new Conv({
        messages: [],
        users: [
          {
            uId: otherUser._id,
            username: otherUser.username,
            avatar: otherUser.avatar
          },
          {
            uId: currentUser._id,
            username: currentUser.username,
            avatar: currentUser.avatar
          }
        ]
      });
      conv = await newConversationStream.save();
    } else {
      conv = await Conv.findById(existingConvId);
    }

    // Signal needs to go to only those interested
    io.getIO().emit("messages", {
      action: "join",
      post: { users: conv.users }
    });

    return { messages: conv.messages, users: conv.users };
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
