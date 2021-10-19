// import { equals } from 'ramda';
import { useReducer, useEffect, useCallback, useRef, Reducer, Dispatch, ReducerAction, ReducerState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  onSnapshot,
  orderBy,
  limit,
  doc,
  // getDoc,
  getDocs,
  setDoc,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/firebase-key
 */

export function encode(component: string): string {
  // Note that exclamation marks are used. The standard encoding mechansim
  // that uses percentage characters doesn't play nice with the REST URLs
  // and the Firebase console (at least) breaks.

  return component.replace(/[\/\.\$\[\]#!]/g, (match) => `!${match.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/firebase-key
 */

export function decode(component: string): string {
  return component.replace(/!([0-9a-f]{2})/gi, (match, code) => String.fromCharCode(parseInt(code, 16)));
}

// TODO - will need to find a way for users to supply their own firebase credentials
const firebaseConfig = {
  apiKey: 'AIzaSyDZtMhc933h53_fbJFmyM76Mh6aRreHZE8',
  authDomain: 'compose-run.firebaseapp.com',
  projectId: 'compose-run',
  storageBucket: 'compose-run.appspot.com',
  messagingSenderId: '685832812042',
  appId: '1:685832812042:web:9c1ff1eca82128832791f3',
  measurementId: 'G-ZX4ZC2215P',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const firebaseAuth = getAuth(app);

// There are sometimes race conditions around cleaning up
// a memory leak and when React detects and complains about it
// This is a wrapper around useReducer that ensures React's
// memory leak detector won't complain
export const useReducerSafe = <A, B, R extends Reducer<A, B>>(
  reducer: R,
  initialState: ReducerState<R>
): [ReducerState<R>, Dispatch<ReducerAction<R>>] => {
  const [val, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef<boolean>();
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const safeDispatch = useCallback(
    (s) => {
      if (mountedRef.current) {
        dispatch(s);
      }
    },
    [dispatch]
  );
  return [val, safeDispatch];
};

function isPromise<A>(p: Promise<A> | A): boolean {
  return p && Object.prototype.toString.call(p) === '[object Promise]';
}

type maybeFirebaseUser = FirebaseUser | null;

// This seems like a more React-safe way to access
// the currently-logged-in Firebase user.
// The other way `getAuth(app).currentUser` doesn't work with React all of the time
export const useFirebaseUser = (): maybeFirebaseUser => {
  const [firebaseUser, setFirebaseUser] = useReducerSafe<
    maybeFirebaseUser,
    maybeFirebaseUser,
    Reducer<maybeFirebaseUser, maybeFirebaseUser>
  >((acc, curr) => curr, null);
  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => setFirebaseUser(user)), []);
  return firebaseUser;
};

// This is a generic help to emit both stream events
// as well as cached behavior values
export const emit = async <A>(
  type: string,
  name: string,
  value: A,
  ts?: Timestamp, // timestamp from an event if we have one
  id?: number // how we tie together an emitted event and the reducer's response
) => {
  try {
    await addDoc(collection(db, type, encode(name), 'values'), {
      value,
      ts: ts || serverTimestamp(),
      id,
    });
  } catch (e) {
    throw new Error('Error emitting event: ' + e.message);
  }
};

// This allows us to tie together an emitted event and the reducer's "response".
// `composeResolvers` is a map from an eventId to that event's Promise's resovle function.
// When the reducer resolver that event, it passes that resolve function as the last argument.
// Calling `await resolve(errors)` for example,
// allows the event emitter to `await` errors from the "server".
const composeResolvers = {};
export function emitWithResponse<B, C>(name: string, value: B): Promise<C> {
  const id = Math.random();
  const promise = new Promise<C>((resolve) => (composeResolvers[id] = resolve));
  emit('streams', name, value, undefined, id);
  return promise;
}

// cache all behaviors in localstorage for optimisic loading
function cacheBehaviorLocalStorage<A>(name: string, value: A, ts: Timestamp) {
  localStorage.setItem(
    `compose-cache-${name}`,
    JSON.stringify({
      value,
      ts,
    })
  );
}

// TODO - store the time retrieved from cached behavior so we can garbage collect
// every X days or so? (make this a parameter?)
function getCachedBehaviorLocalStorage(name: string) {
  const cache = localStorage.getItem(`compose-cache-${name}`);
  if (cache) {
    return JSON.parse(cache).value; // maybe do something with ts eventually;
  }
}

export const getRealtimeState = async (name: string) => {
  const initialBehaviorFromCacheQuery = query(
    collection(db, 'behaviors', encode(name), 'values'),
    orderBy('ts', 'desc'),
    limit(1)
  );
  const {
    docs: [doc],
  } = await getDocs(initialBehaviorFromCacheQuery);
  if (doc && !doc.metadata.hasPendingWrites) {
    return doc.data().value;
  }
};

// save the reducer code to firebase so we can ensure all reducers
// with the same name are identical
function saveReducer<A>(name: string, reducerCode: string, initial: A) {
  setDoc(doc(db, 'behaviors-reducers', encode(name)), {
    reducerCode,
    initial,
  });
}

interface RegisterEmitToSelf<a, b> {
  emitToSelf: (event: RealtimeEvent<a, b>) => void;
  kind: 'RegisterEmitToSelf';
}

interface MismatchedReducerEvent {
  kind: 'MismatchedReducerEvent';
}

interface ReductionEvent<b> {
  value: b;
  ts: Timestamp;
  kind: 'ReductionEvent';
  id: number;
}

interface CacheLoadedEvent<a> {
  currentValue: a;
  ts: Timestamp;
  kind: 'CacheLoadedEvent';
}

interface CacheEmptyEvent {
  kind: 'CacheEmptyEvent';
}

interface InitialValuePromiseLoadedEvent<a> {
  currentValue: a;
  kind: 'InitialValuePromiseLoadedEvent';
}

type RealtimeEvent<a, b> =
  | RegisterEmitToSelf<a, b>
  | MismatchedReducerEvent
  | CacheLoadedEvent<a>
  | CacheEmptyEvent
  | InitialValuePromiseLoadedEvent<a>
  | ReductionEvent<b>;

interface LoadingEmitToSelf<a, b> {
  currentValue: a;
  pendingEvents: ReductionEvent<b>[];
  kind: 'LoadingEmitToSelf';
}

interface MismatchedReducer<a> {
  currentValue: a;
  kind: 'MismatchedReducer';
}

interface LoadingFromCache<a, b> {
  currentValue: a;
  emitToSelf: (event: RealtimeEvent<a, b>) => void;
  pendingEvents: ReductionEvent<b>[];
  kind: 'LoadingFromCache';
}

interface LoadingFromPromise<a, b> {
  currentValue: a;
  pendingEvents: ReductionEvent<b>[];
  kind: 'LoadingFromPromise';
}

interface SetFromInitialValue<a> {
  currentValue: a;
  kind: 'SetFromInitialValue';
}

interface SetFromCacheOrReduction<a> {
  currentValue: a;
  ts: Timestamp;
  kind: 'SetFromCacheOrReduction';
}

type RealtimeReducerContext<a, b> =
  | LoadingEmitToSelf<a, b>
  | MismatchedReducer<a>
  | LoadingFromCache<a, b>
  | LoadingFromPromise<a, b>
  | SetFromInitialValue<a>
  | SetFromCacheOrReduction<a>;

// retrieve the emitter's Promise's resolver function
// and when called, delete it from the map
function getResolver(eventId: number) {
  const resolver = composeResolvers[eventId];
  if (resolver) {
    // eslint-disable-next-line
    return (...args: any[]) => {
      delete composeResolvers[eventId];
      return resolver(...args);
    };
  } else {
    return () => void 0;
  }
}

function realtimeReducer<A, B, C>(
  name: string,
  reducer: (acc: A, curr: B, resolver?: (c: C) => void) => A,
  initialValue: A | Promise<A>,
  loadingValue: A,
  context: RealtimeReducerContext<A, B>,
  event: RealtimeEvent<A, B>
): RealtimeReducerContext<A, B> {
  const cacheOrLoadingValue = getCachedBehaviorLocalStorage(name) || loadingValue;
  if (context.kind === 'MismatchedReducer') {
    return context;
  } else if (event.kind === 'MismatchedReducerEvent') {
    return {
      kind: 'MismatchedReducer',
      currentValue: context.currentValue,
    };
  } else if (context.kind === 'LoadingEmitToSelf') {
    if (event.kind === 'RegisterEmitToSelf') {
      return {
        emitToSelf: event.emitToSelf,
        pendingEvents: context.pendingEvents,
        currentValue: cacheOrLoadingValue,
        kind: 'LoadingFromCache',
      };
    } else if (event.kind === 'ReductionEvent') {
      return {
        pendingEvents: context.pendingEvents.concat([event]),
        currentValue: cacheOrLoadingValue,
        kind: 'LoadingEmitToSelf',
      };
    } else {
      return context;
    }
  } else if (event.kind === 'RegisterEmitToSelf') {
    // no - op, because already registered
    return context;
  } else if (context.kind === 'LoadingFromCache') {
    if (event.kind === 'CacheLoadedEvent') {
      cacheBehaviorLocalStorage(name, event.currentValue, event.ts);
      return {
        currentValue: event.currentValue,
        ts: event.ts,
        kind: 'SetFromCacheOrReduction',
      };
    } else if (event.kind === 'CacheEmptyEvent') {
      if (isPromise(initialValue)) {
        (initialValue as Promise<A>).then((value) => {
          context.emitToSelf({
            currentValue: value,
            kind: 'InitialValuePromiseLoadedEvent',
          });
        });
        return {
          currentValue: cacheOrLoadingValue,
          pendingEvents: context.pendingEvents,
          kind: 'LoadingFromPromise',
        };
      } else {
        saveReducer(name, reducer.toString(), initialValue);
        const newContext = context.pendingEvents.reduce(
          (context: RealtimeReducerContext<A, B>, event) =>
            realtimeReducer(name, reducer, initialValue, loadingValue, context, event),
          {
            currentValue: initialValue as A,
            kind: 'SetFromInitialValue',
          }
        );
        cacheBehaviorLocalStorage(name, newContext.currentValue, 'ts' in newContext && newContext.ts);
        emit('behaviors', name, newContext.currentValue, 'ts' in newContext && newContext.ts);
        return newContext;
      }
    } else if (event.kind === 'ReductionEvent') {
      return {
        ...context,
        pendingEvents: context.pendingEvents.concat([event]),
      };
    } else {
      return context;
    }
  } else if (context.kind === 'LoadingFromPromise') {
    if (event.kind === 'InitialValuePromiseLoadedEvent') {
      saveReducer(name, reducer.toString(), event.currentValue);
      const newContext = context.pendingEvents.reduce(
        (context: RealtimeReducerContext<A, B>, event) =>
          realtimeReducer(name, reducer, initialValue, loadingValue, context, event),
        {
          currentValue: event.currentValue,
          kind: 'SetFromInitialValue',
        }
      );
      cacheBehaviorLocalStorage(name, newContext.currentValue, 'ts' in newContext && newContext.ts);
      emit('behaviors', name, newContext.currentValue, 'ts' in newContext && newContext.ts);
      return newContext;
    } else if (event.kind === 'ReductionEvent') {
      return {
        currentValue: cacheOrLoadingValue,
        pendingEvents: context.pendingEvents.concat([event]),
        kind: 'LoadingFromPromise',
      };
    } else {
      return context;
    }
  } else if (context.kind === 'SetFromInitialValue') {
    if (event.kind === 'ReductionEvent') {
      const currentValue = reducer(context.currentValue, event.value, getResolver(event.id));
      getResolver(event.id)(); // delete & resolve if not done in reducer
      cacheBehaviorLocalStorage(name, currentValue, event.ts);
      emit('behaviors', name, currentValue, event.ts);
      return {
        currentValue,
        ts: event.ts,
        kind: 'SetFromCacheOrReduction',
      };
    } else {
      return context;
    }
  } else if (context.kind === 'SetFromCacheOrReduction') {
    if (event.kind === 'ReductionEvent') {
      if (event.ts.toMillis() > context.ts.toMillis()) {
        const currentValue = reducer(context.currentValue, event.value, getResolver(event.id));
        getResolver(event.id)(); // delete & resolve if not done in reducer
        cacheBehaviorLocalStorage(name, currentValue, event.ts);
        emit('behaviors', name, currentValue, event.ts);
        return {
          currentValue,
          ts: event.ts,
          kind: 'SetFromCacheOrReduction',
        };
      } else {
        return context;
      }
    } else {
      return context;
    }
  } else {
    return context;
  }
}

const realtimeReducers: {
  [name: string]: {
    context: RealtimeReducerContext<unknown, unknown>;
    eventEmitters: Set<Dispatch<RealtimeEvent<unknown, unknown>>>;
    unsubscribe?: Unsubscribe;
  };
} = {};

export function useRealtimeReducer<State, Action, Message>({
  name,
  initialValue,
  reducer,
  loadingValue,
}: {
  name: string;
  initialValue: State | Promise<State>;
  reducer: (state: State, action: Action, resolve?: (message: Message) => void) => State;
  loadingValue: State;
}): [State, (b: Action) => Promise<Message>] {
  const [realtimeContext, emitEvent] = useReducerSafe(
    (context: RealtimeReducerContext<State, Action>, event: RealtimeEvent<State, Action>) =>
      realtimeReducer(name, reducer, initialValue, loadingValue, context, event),
    {
      currentValue: loadingValue,
      pendingEvents: [],
      kind: 'LoadingEmitToSelf',
    }
  );
  useEffect(
    () =>
      emitEvent({
        emitToSelf: emitEvent,
        kind: 'RegisterEmitToSelf',
      }),
    []
  );

  // get initial behavior from firebase cache
  useEffect(() => {
    if (realtimeReducers[name] && realtimeReducers[name].context.kind === 'SetFromCacheOrReduction') {
      emitEvent({
        kind: 'CacheLoadedEvent',
        currentValue: realtimeReducers[name].context.currentValue as State,
        ts: (realtimeReducers[name].context as SetFromCacheOrReduction<unknown>).ts,
      });
    } else {
      const initialBehaviorFromCacheQuery = query(
        collection(db, 'behaviors', encode(name), 'values'),
        orderBy('ts', 'desc'),
        limit(1)
      );
      getDocs(initialBehaviorFromCacheQuery).then((querySnapshot) => {
        const doc = querySnapshot.docs[0];
        if (!doc) {
          emitEvent({ kind: 'CacheEmptyEvent' });
        } else if (!doc.metadata.hasPendingWrites) {
          emitEvent({
            kind: 'CacheLoadedEvent',
            currentValue: doc.data().value,
            ts: doc.data().ts,
          });
        }
      });
    }
  }, [name, emitEvent]);

  // subscribe to all new stream events to reduce upon
  useEffect(() => {
    if (realtimeReducers[name]) {
      realtimeReducers[name].eventEmitters.add(emitEvent);
      return () => {
        realtimeReducers[name].eventEmitters.delete(emitEvent);
        if (realtimeReducers[name].eventEmitters.size === 0) {
          realtimeReducers[name].unsubscribe();
          delete realtimeReducers[name];
        }
      };
    } else {
      realtimeReducers[name] = { context: realtimeContext, eventEmitters: new Set([emitEvent]) };

      const newStreamEventsQuery = query(
        collection(db, 'streams', encode(name), 'values'),
        orderBy('ts', 'desc'),
        limit(1)
      );
      // It seems like this line might not be unsubscribing properly for React
      // sometimes it causes a memory leak warning, but it may be a race condition
      const unsubscribe = onSnapshot(newStreamEventsQuery, (querySnapshot) => {
        const doc = querySnapshot.docs[0];
        if (doc && !doc.metadata.hasPendingWrites) {
          realtimeReducers[name].eventEmitters.forEach((emitter) =>
            emitter({
              kind: 'ReductionEvent',
              value: doc.data().value,
              ts: doc.data().ts,
              id: doc.data().id,
            })
          );
        }
      });

      realtimeReducers[name].unsubscribe = unsubscribe;
      return () => 1; // don't unsubscribe here
    }
  }, [name, emitEvent]);

  return [realtimeContext.currentValue, (value) => emitWithResponse(name, value)];
}
