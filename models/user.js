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
  registryDate: {
    type: String,
    required: true
  },
  contacts: [
    {
      uId: {
        type: Schema.Types.ObjectId,
        required: true
      },
      avatar: {
        type: String,
        required: true
      },
      username: {
        type: String,
        required: true
      }
    }
  ]
});

module.exports = mongoose.model("User", userSchema);
