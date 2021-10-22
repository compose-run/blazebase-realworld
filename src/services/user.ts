import { equals } from 'ramda';
import { getRealtimeState, useFirebaseUser, useRealtimeReducer } from '../services/compose';
import { GenericErrors } from '../types/error';
import { Profile } from '../types/profile';
import { UId, PublicUser } from '../types/user';

interface SignUpUserAction {
  type: 'SIGN_UP';
  user: PublicUser;
}
interface UpdateUserAction {
  type: 'UPDATE';
  newUser: PublicUser;
  uid: UId;
}

type UserAction = SignUpUserAction | UpdateUserAction;

type UserDB = PublicUser[];

const usersVersion = 111;
export const useUsers = () =>
  useRealtimeReducer<UserDB, UserAction, GenericErrors>({
    name: `conduit-users-${usersVersion}`,
    initialValue: getRealtimeState(`conduit-users-${usersVersion - 1}`),
    reducer: (users, action, resolve) => {
      const errors = {};
      if (action.type === 'SIGN_UP') {
        if (users.some((u) => u.username === action.user.username)) {
          errors['username'] = 'already in use';
        }
        if (!Object.keys(errors).length) {
          users = users.concat([action.user]);
        }
      } else if (action.type === 'UPDATE') {
        if (action.uid) {
          users = users.map((u) => (u.uid === action.uid ? action.newUser : u));
        } else {
          errors['unauthorized'] = 'to perform update to user';
        }
      }
      resolve(errors);
      return users;
    },
  });

export const useUser = () => {
  const firebaseUser = useFirebaseUser();
  const [users] = useUsers();

  return firebaseUser && users && users.find((user) => user.uid === firebaseUser.uid);
};
interface FollowUserAction {
  type: 'FollowAction' | 'UnfollowAction';
  uid: UId;
  follower: UId;
  leader: UId;
}

type Follower = { leader: UId; follower: UId };

type FollowersDB = Follower[];

export const useFollowers = () =>
  useRealtimeReducer<FollowersDB, FollowUserAction, GenericErrors>({
    name: `conduit-followers-${usersVersion}`,
    initialValue: getRealtimeState(`conduit-followers-${usersVersion - 1}`).then((s) => s || []),
    reducer: (userFollowers, action, resolve) => {
      const { follower, leader } = action;

      if (action.uid !== follower) {
        resolve({ errors: ['unauthorized to perform this action'] });
        return userFollowers;
      }

      const followers = userFollowers.filter((uf) => !equals(uf, { follower, leader }));

      if (action.type === 'FollowAction') {
        return [...followers, { follower, leader }];
      } else {
        followers;
      }
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
      following:
        user && followers && followers.some(({ follower, leader }) => follower === user.uid && leader === u.uid),
    }))
  );
};
