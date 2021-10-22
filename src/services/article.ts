import { useProfiles, useUser, useUsers } from './user';
import { emitWithResponse, getRealtimeState, useRealtimeReducer } from '../services/compose';
import { GenericErrors } from '../types/error';
import { Article, ArticleForEditor } from '../types/article';
import { PublicUser, UId } from '../types/user';
import { uniq } from 'ramda';

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

const articlesVersion = 116;
export const useArticlesDB = () =>
  useRealtimeReducer<ArticleDB[], ArticleAction, ArticleResolve>({
    name: `conduit-articles-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-articles-${articlesVersion - 1}`).then((s) => s || []),
    reducer: (articles, action, resolve) => {
      const errors = {};
      if (action.uid) {
        if (action.type === 'CreateArticleAction') {
          articles = articles.concat([
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
          updateArticleTags({ slug: action.slug, uid: action.uid, tagList: action.article.tagList });
        } else if (action.type === 'UpdateArticleAction') {
          const article = articles.find(({ slug, uid }) => slug === action.slug && uid == action.uid);
          if (!article) {
            errors['404'] = ['article not found to update'];
          } else if (article.uid !== action.uid) {
            errors['unauthorized'] = ['to edit article'];
          } else {
            articles = articles.map((article) =>
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
            updateArticleTags({ slug: action.slug, uid: action.uid, tagList: action.article.tagList });
          }
        } else if (action.type === 'DeleteArticleAction') {
          const article = articles.find(({ slug, uid }) => slug === action.slug && uid == action.uid);
          if (!article) {
            errors['404'] = ['article not found to update'];
          } else if (article.uid !== action.uid) {
            errors['unauthorized'] = ['to edit article'];
          } else {
            articles = articles.filter((article) => article.slug !== action.slug);
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

      return articles;
    },
  });
interface ArticleTag {
  slug: Slug;
  tag: string;
  uid: UId;
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
    reducer: (articleTagsOption, action, resolve) => {
      const errors = {};
      if (action.uid) {
        if (action.type === 'UpdateArticleTags') {
          // remove all tags for this article
          articleTagsOption = articleTagsOption.filter((pt) => !(pt.uid == action.uid && pt.slug === action.slug));

          // add in tags for this article
          articleTagsOption = articleTagsOption.concat(
            action.tagList.map((tag) => ({ tag, slug: action.slug, uid: action.uid }))
          );
        }
      } else {
        errors['unauthorized'] = 'to edit article';
      }
      resolve(errors);
      return articleTagsOption;
    },
  });

export const useTags = () => {
  const [articleTags] = useArticleTags();
  return articleTags && uniq(articleTags.map(({ tag }) => tag));
};

// when an article is created, this creates all the tags for it
function updateArticleTags(payload: { slug: Slug; tagList: string[]; uid: UId }) {
  return emitWithResponse(`conduit-tags-${articlesVersion}`, { ...payload, type: 'UpdateArticleTags' });
}

interface FavoriteAction {
  type: 'FavoriteAction' | 'UnfavoriteAction';
  slug: Slug;
  uid: UId;
}

type ArticleFavoriteDB = { slug: Slug; uid: UId }[];

export const useArticleFavorites = () =>
  useRealtimeReducer<ArticleFavoriteDB | null, FavoriteAction, GenericErrors>({
    name: `conduit-favorites-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-favorites-${articlesVersion - 1}`).then((s) => s || []),
    reducer: (articleFavorites, action, resolve) => {
      const { slug, uid } = action;
      if (!uid) {
        resolve({ errors: ['unauthorized to perform this action'] });
        return articleFavorites;
      }

      articleFavorites = articleFavorites.filter((f) => !(f.uid == uid && f.slug == slug));

      if (action.type === 'FavoriteAction') {
        articleFavorites = [...articleFavorites, { uid, slug }];
      }

      return articleFavorites;
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
      favorited: user && articleFavorites.some(({ slug, uid }) => user.uid === uid && slug === articleDB.slug),
      favoritesCount: uniq(articleFavorites.filter(({ slug }) => slug === articleDB.slug)).length,
      author: authors.find((u) => u.uid === articleDB.uid),
    }));

  return articles;
};

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
  slug: Slug;
}

type NormalizedCommentDB = CommentNormalized[];

interface CommentResolve {
  errors?: { unauthorized?: string };
}

export const useArticleCommentsDB = () =>
  useRealtimeReducer<NormalizedCommentDB | null, CommentAction, CommentResolve>({
    name: `conduit-comments-${articlesVersion}`,
    initialValue: getRealtimeState(`conduit-comments-${articlesVersion - 1}`).then((s) => s || []),
    reducer: (comments, action, resolve) => {
      if (!action.uid) {
        resolve({ errors: { unauthorized: 'to perform this action' } });
        return comments;
      }

      const { slug, uid, commentId } = action;

      if (action.type === 'CreateComment') {
        const { body, createdAt } = action;
        return [...comments, { uid, commentId, body, createdAt, slug }];
      } else if (action.type === 'DeleteComment') {
        const comment = comments[slug].find((c) => c.commentId === commentId);
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

export interface Comment {
  uid: UId;
  body: string;
  slug: Slug;
  commentId: number;
  createdAt: Date;
  author: PublicUser;
}

type CommentsDB = Comment[];

export const useArticleComments = (): CommentsDB => {
  const [comments] = useArticleCommentsDB();
  const [users] = useUsers();

  return (
    comments &&
    users &&
    comments.map((comment) => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
      author: users.find((u: PublicUser) => u.uid === comment.uid),
    }))
  );
};
