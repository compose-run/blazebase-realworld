import { format } from 'date-fns';
import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Article } from './../../types/article';
import { redirect } from './../../types/location';
import { classObjectToClassName } from './../../types/style';
import { useFollowers, useUser } from './../../services/user';
import { User } from './../../types/user';
import { TagList } from './../ArticlePreview';
import {
  useArticleComments,
  useArticleCommentsDB,
  useArticleFavorites,
  useArticles,
  useArticlesDB,
  Comment,
} from '../../services/article';

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  const articles = useArticles();
  const article = articles && articles.find((a) => a.slug === slug);

  if (articles && !article) {
    redirect('');
  }

  return article ? (
    <div className='article-page'>
      <ArticlePageBanner {...{ article }} />

      <div className='container page'>
        <div className='row article-content'>
          <div className='col-md-12'>{article.body}</div>
          <TagList tagList={article.tagList} />
        </div>

        <hr />

        <div className='article-actions'>
          <ArticleMeta {...{ article }} />
        </div>

        <CommentSection {...{ article }} />
      </div>
    </div>
  ) : (
    <div>Loading article...</div>
  );
}

function ArticlePageBanner(props: { article: Article }) {
  return (
    <div className='banner'>
      <div className='container'>
        <h1>{props.article.title}</h1>

        <ArticleMeta {...props} />
      </div>
    </div>
  );
}

function ArticleMeta({ article }: { article: Article }) {
  const user = useUser();

  return (
    <div className='article-meta'>
      <ArticleAuthorInfo article={article} />

      {user && user.uid === article.author.uid ? (
        <OwnerArticleMetaActions article={article} />
      ) : (
        <NonOwnerArticleMetaActions article={article} />
      )}
    </div>
  );
}

function ArticleAuthorInfo({
  article: {
    author: { username, image },
    createdAt,
  },
}: {
  article: Article;
}) {
  return (
    <Fragment>
      <Link to={`/profile/${username}`}>
        <img src={image || undefined} />
      </Link>
      <div className='info'>
        <Link className='author' to={`/profile/${username}`}>
          {username}
        </Link>
        <span className='date'>{format(new Date(createdAt), 'PP')}</span>
      </div>
    </Fragment>
  );
}

function NonOwnerArticleMetaActions({
  article: {
    slug,
    favoritesCount,
    favorited,
    author: { username, following, uid },
  },
}: {
  article: Article;
}) {
  const [submittingFavorite, setSubmittingFavorite] = useState(false);
  const [submittingFollow, setSubmittingFollow] = useState(false);

  const user = useUser();
  const [, emitFavoriteAction] = useArticleFavorites();
  const [, emitFollowAction] = useFollowers();

  async function onFavorite() {
    if (!user) {
      redirect('register');
      return;
    }

    setSubmittingFavorite(true);

    await emitFavoriteAction({
      type: favorited ? 'UnfavoriteAction' : 'FavoriteAction',
      slug,
      uid: user.uid,
    });

    setSubmittingFavorite(false);
  }

  async function onFollow() {
    if (!user) {
      redirect('register');
      return;
    }

    setSubmittingFollow(true);

    await emitFollowAction({
      type: following ? 'UnfollowAction' : 'FollowAction',
      follower: user.uid,
      uid: user.uid,
      leader: uid,
    });

    setSubmittingFollow(false);
  }

  return (
    <Fragment>
      <button
        className={classObjectToClassName({
          btn: true,
          'btn-sm': true,
          'btn-outline-secondary': !following,
          'btn-secondary': following,
        })}
        disabled={submittingFollow}
        onClick={onFollow}
      >
        <i className='ion-plus-round'></i>
        &nbsp; {(following ? 'Unfollow ' : 'Follow ') + username}
      </button>
      &nbsp;
      <button
        className={classObjectToClassName({
          btn: true,
          'btn-sm': true,
          'btn-outline-primary': !favorited,
          'btn-primary': favorited,
        })}
        disabled={submittingFavorite}
        onClick={onFavorite}
      >
        <i className='ion-heart'></i>
        &nbsp; {(favorited ? 'Unfavorite ' : 'Favorite ') + 'Article'}
        <span className='counter'>({favoritesCount})</span>
      </button>
    </Fragment>
  );
}

function OwnerArticleMetaActions({ article: { slug } }: { article: Article }) {
  const [deleting, setDeleting] = useState(false);

  const user = useUser();
  const [, emitArticleAction] = useArticlesDB();

  async function onDeleteArticle() {
    if (!user) {
      redirect('');
      return;
    }

    setDeleting(true);

    await emitArticleAction({
      type: 'DeleteArticleAction',
      slug,
      uid: user.uid,
    });
  }

  return (
    <Fragment>
      <button className='btn btn-outline-secondary btn-sm' onClick={() => redirect(`editor/${slug}`)}>
        &nbsp; Edit Article
      </button>
      &nbsp;
      <button className='btn btn-outline-danger btn-sm' disabled={deleting} onClick={onDeleteArticle}>
        Delete Article
      </button>
    </Fragment>
  );
}

function CommentSection({ article }: { article: Article }) {
  const user = useUser();
  const comments = useArticleComments();

  return (
    <div className='row'>
      <div className='col-xs-12 col-md-8 offset-md-2'>
        {user ? (
          <CommentForm user={user} slug={article.slug} />
        ) : (
          <p style={{ display: 'inherit' }}>
            <Link to='/login'>Sign in</Link> or <Link to='/register'>sign up</Link> to add comments on this article.
          </p>
        )}
        {comments ? (
          <Fragment>
            {(comments[article.slug] || []).map((comment, index) => (
              <ArticleComment key={comment.commentId} comment={comment} slug={article.slug} user={user} index={index} />
            ))}
          </Fragment>
        ) : (
          <div>Loading comments...</div>
        )}
      </div>
    </div>
  );
}

function CommentForm({ user: { image, uid }, slug }: { user: User; slug: string }) {
  const [body, setBody] = useState('');
  const [submittingComment, setSubmitting] = useState(false);
  const [, emitCommentAction] = useArticleCommentsDB();

  async function onPostComment(ev) {
    ev.preventDefault();

    setSubmitting(true);

    await emitCommentAction({
      type: 'CreateComment',
      uid: uid,
      body,
      slug,
      commentId: Math.random(),
      createdAt: Date.now(),
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
        <img src={image || undefined} className='comment-author-img' />
        <button className='btn btn-sm btn-primary' disabled={submittingComment}>
          Post Comment
        </button>
      </div>
    </form>
  );
}

function ArticleComment({
  comment: { commentId, body, createdAt, author },
  slug,
  index,
  user,
}: {
  comment: Comment;
  slug: string;
  index: number;
  user: User;
}) {
  const { username, image } = author || {};

  const [, emitCommentAction] = useArticleCommentsDB();

  return (
    <div className='card'>
      <div className='card-block'>
        <p className='card-text'>{body}</p>
      </div>
      <div className='card-footer'>
        <Link className='comment-author' to={`/profile/${username}`}>
          <img src={image || undefined} className='comment-author-img' />
        </Link>
        &nbsp;
        <Link className='comment-author' to={`/profile/${username}`}>
          {username}
        </Link>
        <span className='date-posted'>{format(createdAt, 'PP')}</span>
        {user && user.username === username && (
          <span className='mod-options'>
            <i
              className='ion-trash-a'
              aria-label={`Delete comment ${index + 1}`}
              onClick={() =>
                emitCommentAction({
                  slug,
                  commentId,
                  uid: user.uid,
                  type: 'DeleteComment',
                })
              }
            ></i>
          </span>
        )}
      </div>
    </div>
  );
}
