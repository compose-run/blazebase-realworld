import { Fragment, useState } from 'react';
import { useCommentsList } from '../services/comments';
import { useUser } from './../services/user';

export function CommentsListViewer() {
  const [comments, emitCommentAction] = useCommentsList();
  const clist = comments ? (
    <Fragment>
      {comments.length === 0 && <div>No comments yet.</div>}
      <ul>
        {comments.map((comment) => (
          <li key={comment.commentId}>{comment.body}</li>
        ))}
      </ul>
    </Fragment>
  ) : (
    <div>Loading comments.</div>
  );
  return clist;
}

export function CommentForm() {
  const [body, setBody] = useState('');
  const [submittingComment, setSubmitting] = useState(false);
  const [, emitCommentAction] = useCommentsList();
  const user = useUser();

  async function onPostComment(ev) {
    ev.preventDefault();

    setSubmitting(true);
    const uid = user.uid;

    await emitCommentAction({
      type: 'CreateComment',
      uid: uid,
      body,
    });

    setBody('');
    setSubmitting(false);
  }

  return (
    <form className='card comment-form' onSubmit={onPostComment}>
      <div className='card-block'>
        <textarea
          className='form-control'
          placeholder='Write a comment...'
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          value={body}
        ></textarea>
      </div>
      <div className='card-footer'>
        <button className='btn btn-sm btn-primary' disabled={submittingComment}>
          Post Comment
        </button>
      </div>
    </form>
  );
}
