# ComposeJS

_Build fullstack apps without leaving your React Component_

ComposeJS is an experimental backend-as-a-service to provide realtime persistence to React apps.

✅ &nbsp;Add to your app in 60 seconds  
✅ &nbsp;Authentication and realtime updates out-of-the-box  
✅ &nbsp;No SQL, NoSQL, GraphQL, ORMs, or query language  
✅ &nbsp;Caching built-in for lightning-fast page loads  
✅ &nbsp;Open-source. No lock-in.  
❌ &nbsp;Scalable  
❌ &nbsp;Battle-tested  
❌ &nbsp;Works Offline

```ts
import { useState } from 'react';
import { useRealtimeReducer } from 'compose';

export default function ChatApp() {
  const [message, setMessage] = useState('');

  // realtime & persistent via compose
  const [messages, newMessage] = useRealtimeReducer({
    name: 'messages',
    initialValue: [],
    reducer: (messages, message) => [...messages, message],
  });

  return (
    <div>
      {messages ? messages.map((message, index) => <div key={index}>{message}</div>) : 'Loading...'}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            newMessage(message);
            setMessage('');
          }
        }}
      />
    </div>
  );
}
```

## Why Compose

We try as much as possible to keep you in the flow of building your React frontend. There's no separate tool you have to use, new abstractions to learn, or deploy configurations you have to write. We want it to feel like you're _programming your entire backend inside React hooks!_

The main downside is that it currently doesn't scale particularly well. In other words, don't use this if you're building something real that needs to scale. We hope to solve this problem shortly, but we're focused on getting the DX right with small-data applications first. Think: hackathon or side project.

ComposeJS is currently a small, open-source wrapper around Firebase. This provides many services built-in, such as Authentication, Storage, Cloud Functions and more from the Firebase and Google Cloud platforms. Why use ComposeJS over Firebase? ComposeJS wraps Firebase in functional and reactive abstractions that better fit the React model. Eventually we plan to move off Firebase to our own hosted offering.

## Architecture

The classic architecture has three moving pieces, which means three deployments, sets of tooling, languages, and maintainable:

```
Frontend <-> Backend <-> Database
```

A typical Backend-as-a-Service architecture only has two pieces, but requires learning the BaaS query language and security language:

```
Frontend <-> BaaS
```

Unlike any other application stack, Compose allows you to work with persist state _without any query langauge_. Instead we do it all in the tool we know best: JavaScript.

Compose has the same Backend-as-a-Service architecure, but when you zoom in has unidirectional cycle:

```
Event Handler [Frontend] ->
Dispatch Action [Frontend] ->
Timestamp & Serialize Actions [BaaS] ->
Reduce Action [BaaS] ->
Query State [BaaS] ->
React Hook [Frontend]
```

You dispatch actions from a frontend event handler, reduce the actions into realtime & persistent state on the BaaS, query the state on the BaaS, and pull in the reactive state back into the frontend via a React hook.

All in JavaScript! Reduce your actions in JavaScript -- which runs on our servers. Query your persistent state in JavaScript -- also runs on our server. And in both places, you can apply validations and permissioning checks -- all in serverless JavaScript.

## Install

**Beware: Compose is not ready for public use.**

1. Currently, there is no proper NPM package, so simply to copy the [compose.ts](https://github.com/compose-run/realworld/blob/main/src/services/compose.ts) somewhere into your project.
2. `npm install --save firebase` (and `react` if you haven't already)

That's it! If you want to use your own personal Firebase account, there are two extra steps:

3. Replace [our Firebase credentials](https://github.com/compose-run/realworld/blob/main/src/services/compose.ts#L45-L53) with your own from the Firebase Console.
4. Add the following Security Rules to your Firestore database to protect the `uid` field on actions:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true
      allow delete: if false
    }

    match /behaviors/{document=**} {
      allow create: if true
    }

    match /behaviors-reducers/{document=**} {
      allow create: if true
    }

    match /streams/{name}/values/{value} {
      allow create: if !("uid" in request.resource.data) || (request.auth != null && request.auth.uid == request.resource.data.uid)
    }
  }
}
```

## Authentication

Authentication is handled by Firebase. They have email & password, magic link, Facebook, Twitter, and many other authentication methods.

You can read more about web authentication for Firebase here: https://firebase.google.com/docs/auth/web/start

### useFirebaseUser(): [User](https://firebase.google.com/docs/reference/js/auth.user?hl=en)

Once you authenticate via one of Firebase's methods, you can access the currently-logged-in Firebase user with `useFirebaseUser` hook.

Most importantly, this gives you access to the logged-in user's id `uid`, which is the basis of **Authorization and Access Control**, described below.

## Authorization & Access Control

Once you have a user logged in, you can add the `uid` (user id) field to any action you dispatch to a reducer. Then, in the reducer function, you can trust that the author of that action has that `uid`.

In other words, we enforce (via Firebase Security Rules) that the `uid` field on all incoming actions corresponds to that of the user dispatching the action. This can't be forged.

So any other security validation (enforcing uniqueness, enforcing ownership of resources) happens _inside_ the reducer. This means that you don't have to mess with Firebase's Security Rules: you can handle all that logic in your `useRealtimeReducer` hook.

### Example

```ts
interface Message {
  body: string;
  createdAt: number;
  uid: UId;
  id: Id;
}

interface NewMessage {
  type: 'NewMessage';
  newMessage: Message;
  uid: UId;
}

interface DeleteMessage{
  type: "DeleteMessage";
  uid: UId;
  id: string;
}

type MessageAction = NewMessage | DeleteMessage;

type MessageError = string;

const useMessages = useRealtimeReducer<Message[], MessageAction, MessageError>({
  name: 'messages',
  initialValue: [],
  reducer: (messages, action, resolve) => {
    if (action.type === 'NewMessage') {
      if (action.newMessage.body.length < 240) {
        if (action.uid == action.newMessage.uid) {
          return [...messages, action.newMessage];
        } else {
          resolve("User is not authorized to submit this message")
          return messages
        }
      } else {
        resolve('Message too long');
        return messages;
      }
    } else if (action.type === "DeleteMessage") {
      const message = messages.find(({id}) => action.id === id)
      if (!message) {
        resolve('Message not found to delete')
        return messages
      } else if (message.uid !== action.uid) {
        resolve('User is not authorized to delete this message')
        return messages
      else {
        return messages.filter(({id}) => action.id !== id)
      }
    }
  }
});
```

## Private data - _coming soon_

Currently all data in ComposeJS is public, but we are working on a way to add this capability.

## API

### `useRealtimeReducer`

This is the core ComposeJS function. It is a realtime and persistent version of the built-in `useReducer` React hook. Like `useReducer` it takes an `initialValue` and a `reducer` (as keyword arguments), but it also accepts a `name` to uniquely identify the persistent state.

```ts
function useRealtimeReducer<State, Action, Message>({
  name,
  initialValue,
  reducer,
}: {
  name: string;
  initialValue: State | Promise<State>;
  reducer: (state: State, action: Action, resolve?: (message: Message) => void) => State;
}): [State | undefined, (action: Action) => Promise<Message>];
```

It returns an array. The first value represents the realtime, persistent state. The second is a function which allows you to dispatch values ("actions" in Redux terminology) to the reducer.

Unlike the local hook, `useRealtimeReducer` dispatches all actions to a server which timestamps them and runs your reducer function. Any state changes are beamed back to each client node efficiently as diffs.

In development mode, the reducer runs locally every user's browser. When you build your application, ComposeJS automatically pulls out your reducer functions into separate files to be deployed as Google Cloud or Lambda Functions.

`useRealtimeReducer` provides a way for the reducer to communicate directly back to the action dispatcher. This can useful when the frontend waits on a reducer to confirm or reject an action. For example, when a user picks a name that needs to be unique, your app can `await dispatcher(someAction)` for success or rejection message. You can send these messages back to dispatchers by having your reducer accept a third argument: a `resolve` function. In the reducer, you can `resolve(someMessage)` which will resolve the Promise for the dispatcher of that action.

It is considered good practice to make reducers deterministic. When you use `Date.now` or `Math.random()`, do it on the client and dispatch those non-deterministic values to the reducer.

#### Example Usage

```ts
interface Message {
  body: string;
  createdAt: number;
}

interface NewMessage {
  type: 'NewMessage';
  newMessage: Message;
}

type MessageAction = NewMessage;

type MessageError = string;

const useMessages = useRealtimeReducer<Message[], MessageAction, MessageError>({
  name: 'messages',
  initialValue: [],
  reducer: (oldValue, action, resolve) => {
    if (action.type === 'NewMessage') {
      if (action.newMessage.body.length < 240) {
        return [...oldValue, action.newMessage];
      } else {
        resolve('Message too long');
        return oldValue;
      }
    }
  },
});
```

### `getRealtimeState<A>(name: string): Promise<State | null>`

`getRealtimeState` accepts a realtime state name and returns a Promise with it's value.

It can be useful to spy the current value of some state:

```ts
getRealtimeState('my-state-1').then(console.log);
```

## Folder structure

This codebase was created to demonstrate a fully fledged fullstack application built with React, Typescript, and ComposeJS.

[Compose Realworld Live Demo](https://compose-run.github.io/realworld/#/)

This repo was forked from [ts-redux-react-realworld-example-app](https://github.com/angelguzmaning/ts-redux-react-realworld-example-app) by [@angelguzmaning](https://github.com/angelguzmaning), which was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

The root of the application is the `src/components/App` component. The App component uses react-router's HashRouter to display the different pages. Each page is represented by a [function component](https://reactjs.org/docs/components-and-props.html).

This application is built following (as much as practicable) functional programming principles:

- Immutable Data
- No classes
- No let or var
- No side effects

The code avoids runtime type-related errors by using Typescript and decoders for data coming from the API.

This project uses prettier and eslint to enforce a consistent code syntax.

- `src/components` Contains all the functional components.
- `src/components/Pages` Contains the components used by the router as pages.
- `src/state` Contains redux related code.
- `src/services` Contains the code that interacts with external systems (ComposeJS).
- `src/types` Contains type definitions alongside the code related to those types.
- `src/config` Contains configuration files.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.

Note: This project will run the app even if linting fails.

### `npm run lint`

Enforces the prettier and eslint rules for this project. This is what is run on the pre-commit hook.

### `npm run build`

Builds the app for production to the `build` folder.

It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.

### `npm run deploy`

This project is configured to be deployed to Github Pages, which works because the routing is hash-based and ComposeJS is fully serverless.
