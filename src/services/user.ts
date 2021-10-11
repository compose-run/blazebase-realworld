import { getRealtimeState, useFirebaseUser, useRealtimeReducer } from '../services/compose';
import { GenericErrors } from '../types/error';
import { Profile } from '../types/profile';
import { User, UId } from '../types/user';

interface SignUpUserAction {
  type: 'SIGN_UP';
  user: User;
}
interface UpdateUserAction {
  type: 'UPDATE';
  newUser: User;
  uid: UId;
}

type UserAction = SignUpUserAction | UpdateUserAction;

type UserDB = User[];

const usersVersion = 107;
export const useUsers = () =>
  useRealtimeReducer<UserDB, UserAction, GenericErrors>({
    name: `conduit-users-${usersVersion}`,
    initialValue: getRealtimeState(`conduit-users-${usersVersion - 1}`),
    loadingValue: null,
    reducer: (users, action, resolve) => {
      const errors = {};
      let returnValue = users;
      if (action.type === 'SIGN_UP') {
        if (users.some((u) => u.email === action.user.email)) {
          errors['email'] = 'already in use';
        }
        if (users.some((u) => u.username === action.user.username)) {
          errors['username'] = 'already in use';
        }
        if (users.some((u) => u.uid === action.user.uid)) {
          errors['public-key'] = 'already in use';
        }
        if (!Object.keys(errors).length) {
          returnValue = users.concat([action.user]);
        }
      } else if (action.type === 'UPDATE') {
        if (action.uid) {
          returnValue = users.map((u) => (u.uid === action.uid ? action.newUser : u));
        } else {
          errors['unauthorized'] = 'to perform update to user';
        }
      }
      resolve(errors);
      return returnValue;
    },
  });

export const useProfiles = (): Profile[] => {
  const user = useUser();
  const [users] = useUsers();
  const [followers] = useFollowers();

  return (
    users &&
    users.map((u) => ({
      ...u,
      following: user && followers && !!(followers[user.uid] || {})[u.uid],
    }))
  );
};

interface FollowUserAction {
  type: 'FollowAction' | 'UnfollowAction';
  uid: UId;
  follower: UId;
  leader: UId;
}

export const useFollowers = () =>
  useRealtimeReducer({
    name: `conduit-followers-${usersVersion}`,
    initialValue: getRealtimeState(`conduit-followers-${usersVersion - 1}`).then((s) => s || {}),
    loadingValue: null,
    reducer: (userFollowers, action: FollowUserAction, resolve) => {
      const { follower, leader } = action;

      if (action.uid !== follower) {
        resolve({ errors: { unauthorized: 'to perform this action' } });
        return userFollowers;
      }

      const following = action.type === 'FollowAction';

      return {
        ...userFollowers,
        [follower]: {
          ...(userFollowers[follower] || {}),
          [leader]: following,
        },
      };
    },
  });

export const useUser = () => {
  const firebaseUser = useFirebaseUser();
  const [users] = useUsers();

  return firebaseUser && users && users.find((user) => user.uid === firebaseUser.uid);
};
