const { buildSchema } = require("graphql");

module.exports = buildSchema(`
    type User {
        _id: ID!
        username: String!
        email: String!
        password: String!
    }

    type AuthData {
        token: String!
        userId: String!
    }

    type ConfirmData {
        messages: [Message!]!
    }

    type Message {
        uId: String!
        body: String!
        date: String!
    }

    type UserMini {
        uId: String!
        username: String!
    }
    
    type ConversationData {
        messages: [Message!]!
        users: [UserMini!]!
    }

    input UserInputData {
        username: String!
        email: String!
        password: String!
        repeatPassword: String!
    }

    input MessageInputData {
        conversationId: String!
        userId: String!
        body: String!
    }

    type RootQuery {
        login(username: String!, password: String!): AuthData!
        fetchConversation(conversationId: String!): ConversationData!
    }

    type RootMutation {
        createUser(userInput: UserInputData): User!
        createMessage(messageInput: MessageInputData): ConfirmData!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);
