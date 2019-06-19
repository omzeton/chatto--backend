const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${
  process.env.MONGO_PASS
}@cluster0-cuqhr.mongodb.net/${process.env.MONGO_DB}`;

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const graphqlHttp = require("express-graphql");
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const cors = require('cors');

const app = express();

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use(
  "/graphql",
  cors(),
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver
  })
);

app.use((error, req, res, next) => {
  let newError = error.data ? error.data[0] : error;
  const status = newError.statusCode || 500;
  const message = newError.msg;
  res.status(status).json({ message: message });
});

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useFindAndModify: false })
  .then(() => {
    console.log("在线");
    app.listen(8080);
    // const server = app.listen(8080);
    // const io = require('./socket').init(server);
    // io.on('connection', socket => {
    //   console.log('Client connected');
    // });
  })
  .catch(err => {
    console.log(err);
  });
