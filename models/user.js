const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    required: true
  },
  conversations: [
    {
      cId: {
        type: Schema.Types.ObjectId,
        ref: 'Conv'
      },
      url: {
        type: String,
        required: true
      },
      date: {
        type: String,
        required: true
      }
    }
  ]
});

module.exports = mongoose.model("User", userSchema);
