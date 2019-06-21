const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const convSchema = new Schema({
  messages: [
    {
      uId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false
      },
      body: {
        type: String,
        required: false
      },
      date: {
        type: String,
        required: false
      },
      avatar: {
        type: String,
        required: true
      }
    }
  ],
  users: [
    {
      uId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      username: {
        type: String,
        required: true
      },
      avatar: {
        type: String,
        required: true
      }
    }
  ]
}, {collection: 'conv'});

module.exports = mongoose.model("Conv", convSchema);
