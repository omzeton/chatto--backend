const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${
  process.env.MONGO_PASS
}@cluster0-cuqhr.mongodb.net/${process.env.MONGO_DB}`;

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const graphqlHttp = require("express-graphql");
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const cors = require("cors");
const multer = require("multer");
const uuidv4 = require("uuid/v4");
const path = require("path");
const fs = require("fs");

const app = express();

const fileStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "images");
  },
  filename: function(req, file, cb) {
    cb(null, uuidv4());
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());

app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.put("/post-image", (req, res, next) => {
  console.log(req.body.oldPath);
  if (!req.file) {
    return res.status(200).json({ message: "No file provided" });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  const newFile = req.file.path.replace("\\", "/");
  return res.status(201).json({ message: "File stored", filePath: newFile });
});

app.use(
  "/graphql",
  cors(),
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || "An error occurred.";
      const code = err.originalError.code || 500;
      return { message: message, status: code, data: data };
    }
  })
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useFindAndModify: false })
  .then(() => {
    const server = app.listen(8080);
    const io = require("./socket").init(server);
    io.on("connection", socket => {
      console.log("Client connected");
    });
  })
  .catch(err => {
    console.log(err);
  });

const clearImage = filePath => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, err => console.log(err));
};
