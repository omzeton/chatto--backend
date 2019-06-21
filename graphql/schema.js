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

    type Message {
        uId: String!
        body: String!
        date: String!
        avatar: String!
    }

    type UserMini {
        uId: String!
        username: String!
        avatar: String!
    }
    
    type ConversationData {
        messages: [Message!]!
        users: [UserMini!]!
    }

    type Link {
        chatroomLink: String!
        url: String!
        date: String!
    }

    type Url {
        chatroomUrl: String!
    }

    type Conversations {
        conversations: [Link!]
    }

    type AvatarConfirm {
        message: String!
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
        avatar: String!
    }

    type RootQuery {
        login(username: String!, password: String!): AuthData!
        fetchConversation(conversationId: String!): ConversationData!
        createLink(userId: String!): Link!
        connectToConversation(chatroomLink: String!, userId: String!): Url!
        getPreviousConversations(userId: String!): Conversations!
    }

    type RootMutation {
        createUser(userInput: UserInputData): User!
        createMessage(messageInput: MessageInputData): ConfirmData!
        changeUserAvatar(fileUrl: String!, userId: String!): AvatarConfirm!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);