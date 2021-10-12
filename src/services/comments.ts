import { useProfiles, useUser, useUsers } from './user';
import { emitWithResponse, getRealtimeState, useRealtimeReducer } from '../services/compose';
import { GenericErrors } from '../types/error';
import { User, UId } from '../types/user';
import { v4 as uuidv4 } from 'uuid';

// TODO: Deduplicate shared fields in these actions.
interface CreateCommentAction {
  type: 'CreateComment';
  uid: UId;
  body: string;
  //  createdAt: number;
}

interface DeleteCommentAction {
  type: 'DeleteComment';
  uid: UId;
  commentId: string;
}

type CommentAction = CreateCommentAction | DeleteCommentAction;

export interface Comment {
  uid: UId;
  body: string;
  commentId: string;
  //  createdAt: Date;
}

interface CommentResolve {
  errors?: { unauthorized?: string };
}

// TODO: Make this CommentId -> Comment?
type CommentsList = Comment[];

export const useCommentsList = () =>
  useRealtimeReducer<CommentsList | null, CommentAction, CommentResolve>({
    name: 'comments',
    initialValue: [],
    loadingValue: null,
    reducer: (comments, action, resolve) => {
      // TODO: Checking whether user matches/is logged in
      if (!action.uid) {
        resolve({ errors: { unauthorized: 'to perform this action' } });
        return comments;
      }

      const { uid } = action;

      if (action.type === 'CreateComment') {
        const { body } = action;
        const commentId = uuidv4();
        return [...comments, { uid, commentId, body }];
      } else if (action.type === 'DeleteComment') {
        const commentId = action.commentId;
        const comment = comments.find((c) => c.commentId === commentId);
        if (comment && comment.uid === action.uid) {
          return comments.filter((c) => c.commentId !== commentId);
        } else {
          resolve({ errors: { unauthorized: 'to perform this action' } });
          return comments;
        }
      } else {
        return comments;
      }
    },
  });
