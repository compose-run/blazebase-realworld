import { useProfiles, useUser, useUsers } from './user';
import { emitWithResponse, getRealtimeState, useRealtimeReducer } from '../services/compose';
import { GenericErrors } from '../types/error';
import { Article, ArticleForEditor } from '../types/article';
import { User, UId } from '../types/user';

type Slug = string;
interface CreateArticleAction {
  type: 'CreateArticleAction';
  article: ArticleForEditor;
  uid: UId;
  slug: Slug;
  createdAt: number;
}

interface UpdateArticleAction {
  type: 'UpdateArticleAction';
  article: ArticleForEditor;
  slug: Slug;
  uid: UId;
  updatedAt: number;
}

interface DeleteArticleAction {
  type: 'DeleteArticleAction';
  slug: Slug;
  uid: UId;
}

type ArticleAction = CreateArticleAction | UpdateArticleAction | DeleteArticleAction;

export interface ArticleDB {
  slug: Slug;
  title: string;
  description: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  uid: UId;
}

interface ArticleResolve {
  slug?: string;
  errors?: GenericErrors;
}

const articlesVersion = 115;
export const useArticlesDB = () =>
  useRealtimeReducer<ArticleDB[], ArticleAction, ArticleResolve>({
    name: `conduit-articles-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-articles-${articlesVersion - 1}`).then((s) => s || []),
    loadingValue: null,
    reducer: (articles, action, resolve) => {
      const errors = {};
      let returnValue = articles;
      if (action.uid) {
        if (action.type === 'CreateArticleAction') {
          returnValue = articles.concat([
            {
              slug: action.slug,
              title: action.article.title,
              description: action.article.description,
              body: action.article.body,
              createdAt: action.createdAt,
              updatedAt: action.createdAt,
              uid: action.uid,
            },
          ]);
          updateArticleTags({ slug: action.slug, tagList: action.article.tagList });
        } else if (action.type === 'UpdateArticleAction') {
          // TODO - only do if action.uid matches
          returnValue = articles.map((article) =>
            article.slug == action.slug && article.uid === action.uid
              ? {
                  ...article,
                  title: action.article.title,
                  description: action.article.description,
                  body: action.article.body,
                  updatedAt: action.updatedAt,
                }
              : article
          );
          updateArticleTags({ slug: action.slug, tagList: action.article.tagList });
        } else if (action.type === 'DeleteArticleAction') {
          // TODO - only do if action.uid matches
          if (articles.find((a) => a.slug == action.slug).uid === action.uid) {
            returnValue = articles.filter((article) => article.slug !== action.slug);
          }
        }
      } else {
        errors['unauthorized'] = ['to edit article'];
      }
      if (Object.keys(errors).length) {
        resolve({ errors });
      } else {
        resolve({ slug: action.slug });
      }

      return returnValue;
    },
  });
interface ArticleTag {
  slug: Slug;
  tag: string;
}

interface UpdateArticleTags {
  type: 'UpdateArticleTags';
  slug: Slug;
  tagList: string[];
  uid: UId;
}

type ArticleTagAction = UpdateArticleTags;

export const useArticleTags = () =>
  useRealtimeReducer<ArticleTag[], ArticleTagAction, GenericErrors>({
    name: `conduit-tags-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-tags-${articlesVersion - 1}`).then((s) => s || []),
    loadingValue: null,
    reducer: (articleTagsOption, action, resolve) => {
      const errors = {};
      let returnValue = articleTagsOption as ArticleTag[]; // TODO rearchitect this around lookups like favorites?
      if (action.uid === 'TODO') {
        if (action.type === 'UpdateArticleTags') {
          returnValue = returnValue.filter((pt) => pt.slug !== action.slug || action.tagList.includes(pt.tag));
          returnValue = returnValue.concat(
            action.tagList
              .filter((tag) => !returnValue.some((pt) => pt.slug === action.slug && pt.tag === tag))
              .map((tag) => ({ tag, slug: action.slug }))
          );
        }
      } else {
        errors['unauthorized'] = 'to edit article';
      }
      resolve(errors);
      return returnValue;
    },
  });

export const useTags = () => {
  const [articleTags] = useArticleTags();
  return articleTags && Array.from(new Set(articleTags.map(({ tag }) => tag)));
};

// TODO - what's going on with this function...?
function updateArticleTags(payload: { slug: Slug; tagList: string[] }) {
  return emitWithResponse(`conduit-tags-${articlesVersion}`, { ...payload, type: 'UpdateArticleTags' });
}

interface FavoriteAction {
  type: 'FavoriteAction' | 'UnfavoriteAction';
  slug: Slug;
  uid: UId;
}

export const useArticleFavorites = () =>
  useRealtimeReducer({
    name: `conduit-favorites-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-favorites-${articlesVersion - 5}`).then(
      (s) => s || { articles: {}, users: {} }
    ),
    loadingValue: null,
    reducer: ({ articles, users }, action: FavoriteAction, resolve) => {
      if (!action.uid) {
        resolve({ errors: { unauthorized: 'to perform this action' } });
        return { articles, users };
      }

      const { slug, uid } = action;
      const favorite = action.type === 'FavoriteAction';

      return {
        articles: {
          ...articles,
          [slug]: {
            ...(articles[slug] || {}),
            [uid]: favorite,
          },
        },
        users: {
          ...users,
          [uid]: {
            ...(users[uid] || {}),
            [slug]: favorite,
          },
        },
      };
    },
  });

export const useArticles = (): Article[] => {
  const user = useUser();
  const [articlesDB] = useArticlesDB();
  const [articleTags] = useArticleTags();
  const [articleFavorites] = useArticleFavorites();
  const authors = useProfiles();

  const articles =
    articlesDB &&
    articleTags &&
    authors &&
    articleFavorites &&
    articlesDB.map((articleDB) => ({
      slug: articleDB.slug,
      title: articleDB.title,
      description: articleDB.description,
      body: articleDB.body,
      tagList: articleTags.filter((articleTag) => articleTag.slug === articleDB.slug).map(({ tag }) => tag),
      createdAt: new Date(articleDB.createdAt),
      updatedAt: new Date(articleDB.updatedAt),
      favorited:
        user && articleFavorites.articles[articleDB.slug] && articleFavorites.articles[articleDB.slug][user.uid],
      favoritesCount: Object.values(articleFavorites.articles[articleDB.slug] || {}).filter((favorite) => favorite)
        .length,
      author: authors.find((u) => u.uid === articleDB.uid),
    }));

  return articles;
};

// TODO: Deduplicate shared fields in these actions.
interface CreateCommentAction {
  type: 'CreateComment';
  uid: UId;
  body: string;
  slug: Slug;
  commentId: number;
  createdAt: number;
}

interface DeleteCommentAction {
  type: 'DeleteComment';
  uid: UId;
  slug: Slug;
  commentId: number;
}

type CommentAction = CreateCommentAction | DeleteCommentAction;

interface CommentNormalized {
  uid: UId;
  commentId: number;
  body: string;
  createdAt: number;
}

type NormalizedCommentDB = { [key: Slug]: CommentNormalized[] };

interface CommentResolve {
  errors?: { unauthorized?: string };
}

export const useArticleCommentsDB = () =>
  useRealtimeReducer<NormalizedCommentDB | null, CommentAction, CommentResolve>({
    name: `conduit-comments-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-comments-${articlesVersion - 1}`).then((s) => s || {}),
    loadingValue: null,
    reducer: (comments, action, resolve) => {
      if (!action.uid) {
        resolve({ errors: { unauthorized: 'to perform this action' } });
        return comments;
      }

      const { slug, uid, commentId } = action;

      if (action.type === 'CreateComment') {
        const { body, createdAt } = action;
        return {
          ...comments,
          [slug]: [...(comments[slug] || []), { uid, commentId, body, createdAt }],
        };
      } else if (action.type === 'DeleteComment') {
        const comment = comments[slug].find((c) => c.commentId === commentId);
        if (comment && comment.uid === action.uid) {
          return {
            ...comments,
            [slug]: [...(comments[slug] || []).filter((c) => c.commentId !== commentId)],
          };
        } else {
          resolve({ errors: { unauthorized: 'to perform this action' } });
          return comments;
        }
      } else {
        return comments;
      }
    },
  });

export interface Comment {
  uid: UId;
  body: string;
  slug: Slug;
  commentId: number;
  createdAt: Date;
  author: User;
}

type CommentsDB = { [slug: Slug]: Comment[] };

export const useArticleComments = (): CommentsDB => {
  const [comments] = useArticleCommentsDB();
  const [users] = useUsers();

  return (
    comments &&
    users &&
    Object.fromEntries(
      Object.entries(comments).map(([slug, comments]) => [
        slug,
        comments.map((comment) => ({
          ...comment,
          slug,
          createdAt: new Date(comment.createdAt),
          author: users.find((u: User) => u.uid === comment.uid),
        })),
      ])
    )
  );
};
