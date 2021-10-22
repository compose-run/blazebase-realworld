# Blazebase implementation of the [RealWorld](https://github.com/gothinkster/realworld) spec

## [Live demo](https://compose-run.github.io/blazebase-realworld/#/)

This codebase was created to demonstrate a fully fledged fullstack application built with React, Typescript, and Blazebase.

For more information on how this works with other frontends/backends, head over to the [RealWorld](https://github.com/gothinkster/realworld) repo.

# How it works

The root of the application is the `src/components/App` component. The App component uses react-router's HashRouter to display the different pages. Each page is represented by a [function component](https://reactjs.org/docs/components-and-props.html).

This application is built following (as much as practicable) functional programming principles:

- Immutable Data
- No classes
- No let or var
- No side effects

The code avoids runtime type-related errors by using Typescript and decoders for data coming from the API.

This project uses prettier and eslint to enforce a consistent code syntax.

## Folder structure

- `src/components` Contains all the functional components.
- `src/components/Pages` Contains the components used by the router as pages.
- `src/state` Contains redux related code.
- `src/services` Contains the code that interacts with external systems (Blazebase).
- `src/types` Contains type definitions alongside the code related to those types.
- `src/config` Contains configuration files.

# Getting started

This project was forked from [ts-redux-react-realworld-example-app](https://github.com/angelguzmaning/ts-redux-react-realworld-example-app) by [@angelguzmaning](https://github.com/angelguzmaning), which was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

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

This project is configured to be deployed to Github Pages, which works because the routing is hash-based and Blazebase is fully serverless.

# Blazebase

_Add a little realtime & persistence to your React app_

Blazebase is an experimental backend-as-a-service to provide realtime persistence to React apps.

✅ &nbsp;Add to your app in 60 seconds  
✅ &nbsp;Authentication and realtime updates out-of-the-box  
✅ &nbsp;No SQL, NoSQL, ORMs, query language: it's just React & JS on the backend  
✅ &nbsp;Caching built-in for lightning-fast page loads  
✅ &nbsp;Reusable Realtime React Components, which bring their data with them, and send updates back  
✅ &nbsp;Open-source. No lock-in.  
❌ &nbsp;Scalable  
❌ &nbsp;Battle-tested
❌ &nbsp;Work Offline

```ts
import { useState } from 'react';
import { useRealtimeReducer } from 'blazebase';

export default function ChatApp() {
  const [message, setMessage] = useState('');

  // realtime & persistent via blazebase
  const [messages, newMessage] = useRealtimeReducer({
    name: 'steves-chat-app-4',
    reducer: (messages, message) => messages.concat([message]),
    initialValue: [],
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

We try as much as possible to keep you in the flow of building your React frontend. There's no separate tool you have to use, new abstractions to learn, or deploy configurations you have to write. We want it to feel like you're _programming your entire backend inside React hooks!_

The main downside is that it currently doesn't scale particularly well. In other words, don't use this if you're building something real that needs to scale. We hope to solve this problem shortly, but we're focused on getting the DX right with small-data applications first. Think: hackathon or side project.

Blazebase is a small, open-source wrapper around Firebase. This provides many services built-in, such as Authentication, Storage, Cloud Functions and more from the Firebase and Google Cloud platforms. Why use Blazebase over Firebase? Blazebase wraps Firebase in functional and reactive abstractions that better fit the React model.

## Install

Blazebase isn't currently ready public use. Contact steve@compose.run if you're interested in giving it a spin.

## Configuring

1. No setup - run your application on our Firebase instance. The upside is you can get started immediately and we store your data for free, but the downside is that we give zero guarantees about it's privacy or availability. Read: we may delete all your data at any time. Also, all of your data is 100% public, so be very careful about what you put on it.
2. Setup with your own firebase account - _Coming soon_

## API

### `useRealtimeReducer`

This is the core Blazebase function. It is a realtime and persistent version of the built-in `useReducer` React hook. Like `useReducer` it takes an `initialValue` and a `reducer` (as keyword arguments), but it also accepts a `name` to uniquely identify the persistent state.

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

In development mode, the reducer runs locally every user's browser. When you build your application, Blazebase automatically pulls out your reducer functions into separate files to be deployed as Google Cloud or Lambda Functions.

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

It is also useful in migrations. More on this in the **Migrations** sections below.

## Migrations

Realtime reducers are _immutable_ in the sense that once created, can _never be redefined or arbitrarily mutated_. Any state change is fully described in the reducer function.

This is inspired by immutability in functional programming, one of the core abstractions in React. While we of course need data to _change over time_, we want to model that reactivity immutably. Unlike a database, which is a big blob of mutable state, which any part of your app can mutate in any way at any time, all persistent state in Blazebase is defined once and only once, and cannot be mutated from anywhere. Only its predefined actions can affect it, in the ways predefined by its reducer.

Thus: the question of migration. In a normal database app, migrations happen whenever the schema changes. In Blazebase, migrations happen whenever either the schema _or_ the reducer function changes.

However, a simple migration without a schema change is easy: just want to migrate over all the data. This is how you set it up:

1. Create a version number for a piece or group of pieces of related state
2. Put that version number in the state's name
3. Set the initial state to the previous version's state - 1
4. Handle the base case (where `useRealtimeState` returns `null`) by providing an _initial_ initial value

```ts
const veryFirstValue = []
const myStateVersion = 0 // increment this number to migrate the data
useRealtimeReducer({
  name: `my-state-${myStateVersion}`,
  initialValue: getRealtimeState(`my-state-${myStateVersion - 1}`).then(s => s || veryFirstValue), // the initial value of the new version is the last value of the previous version
  ...
})
```

In the case where you need to make a more traditional migration because of a schema change, you can include that logic, and then return to the versioning scheme:

```ts
const veryFirstValue = []
const myStateVersion = 11
const myStateMigrations = {
  11: (oldState) => { ... }
}
useRealtimeReducer({
  name: `my-state-${myStateVersion}`,
  initialValue: getRealtimeState(`my-state-${myStateVersion - 1}`).then(s => myStateMigrations[myStateVersion] ? myStateMigrations[myStateVersion](s) : s),
  ...
})
```

A similar scheme can be used for creating forks of your realtime state for working in git branches.

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

Currently all data in Blazebase is public, but we are working on a way to add this capability.
