const { buildSchema } = require("graphql");

module.exports = buildSchema(`
    type User {
        _id: ID!
        username: String!
        email: String!
        password: String!
        avatar: String!
    }

    type AuthData {
        token: String!
        userId: String!
        username: String!
        avatar: String!
    }

    type ConfirmData {
        messages: [Message!]!
    }

    type ConversationData {
        messages: [Message!]!
        users: [UserMini!]!
    }

    type Message {
        uId: String!
        body: String!
        date: String!
        avatar: String!
        attachment: String!
    }

    type UserMini {
        _id: String!
        uId: String!
        username: String!
        avatar: String!
    }
    
    type Confirmation {
        message: String!
    }

    type DeletionStatus {
        status: Int!
    }

    type Allusers {
        users: [UserMini!]!
    }

    type ContactList {
        contacts: [UserMini!]!
    }

    input UserInputData {
        username: String!
        email: String!
        password: String!
        repeatPassword: String!
    }

    input MessageInputData {
        ownId: String!
        otherId: String!
        body: String!
        avatar: String!
        attachment: String!
    }

    type RootQuery {
        login(username: String!, password: String!): AuthData!
        fetchAllUsers(userId: String!): Allusers!
        connectToStream(otherId: String!, ownId: String!, useFirstContact: Boolean!): ConversationData!
        fetchContactList(userId: String!): ContactList!
    }

    type RootMutation {
        createUser(userInput: UserInputData): User!
        createMessage(messageInput: MessageInputData): ConfirmData!
        changeUserAvatar(fileUrl: String!, userId: String!): Confirmation!
        changePassword(oldPassword: String!, newPassword: String!, repeatPassword: String!, userId: String!): Confirmation!
        changeUsername(username: String!, userId: String!): Confirmation!
        deleteAccount(userId: String!): DeletionStatus!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);