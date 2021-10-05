import { signed, useProfiles, useUser, useUsers } from './user';
import { emitWithResponse, getRealtimeState, useRealtimeReducer, useRealtimeReducer2 } from '../services/compose';
import { GenericErrors } from '../types/error';
import { Article, ArticleForEditor } from '../types/article';

interface CreateArticleAction {
  type: "CreateArticleAction";
  article: ArticleForEditor;
  publicKey: string;
  signature: string;
  slug: string;
  createdAt: number;
}

interface UpdateArticleAction {
  type: "UpdateArticleAction";
  article: ArticleForEditor;
  slug: string;
  signature: string;
  publicKey: string;
  updatedAt: number;
}

interface DeleteArticleAction {
  type: "DeleteArticleAction";
  slug: string;
  signature: string;
  publicKey: string;
}

type ArticleAction = CreateArticleAction | UpdateArticleAction | DeleteArticleAction

export interface ArticleDB {
  slug: string;
  title: string;
  description: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  authorPublicKey: string;
}

interface ArticleResolve { slug?: string, errors?: GenericErrors }

const articlesVersion = 32
export const useArticlesDB = () => useRealtimeReducer<ArticleDB[] | null, ArticleAction, ArticleResolve>(`conduit-articles-${articlesVersion}`, (articles, action, resolve) => {
  let errors = {}
  let returnValue = articles
  if (signed(action)) {
    if (action.type === "CreateArticleAction") {
      returnValue = articles.concat([{
        slug: action.slug, 
        title: action.article.title,
        description: action.article.description,
        body: action.article.body,
        createdAt: action.createdAt,
        updatedAt: action.createdAt,
        authorPublicKey: action.publicKey
      }])
      updateArticleTags({slug: action.slug, tagList: action.article.tagList})
    } else if (action.type === "UpdateArticleAction") {
      returnValue = articles.map(article => 
        article.slug == action.slug && article.authorPublicKey === action.publicKey 
          ? {
              ...article,
              title: action.article.title,
              description: action.article.description,
              body: action.article.body,
              updatedAt: action.updatedAt
            } 
          : article
      )
      updateArticleTags({slug: action.slug, tagList: action.article.tagList})
    } else if (action.type === "DeleteArticleAction") {
      if (articles.find(a => a.slug == action.slug).authorPublicKey === action.publicKey) {
        returnValue = articles.filter(article => article.slug !== action.slug)
      }
      
    }
  } else {
    errors['unauthorized'] = ['to edit article']
  }
  if (Object.keys(errors).length) {
    resolve({errors})
  } else {
    resolve({slug: action.slug})
  }
  
  return returnValue
}, getRealtimeState(`conduit-articles-${articlesVersion-1}`).then(articles => articles && articles.map((a) => ({...a, updatedAt: 0 - - a.updatedAt}))), null) // TODO - where did this bug from from?

interface ArticleTag {
  slug: string;
  tag: string;
}

interface UpdateArticleTags {
  type: "UpdateArticleTags";
  slug: string,
  tagList: string[];
}

type ArticleTagAction = UpdateArticleTags;

const articleTagsDbId = `conduit-tags-${articlesVersion}`
export const useArticleTags = () => useRealtimeReducer<ArticleTag[] | null, ArticleTagAction, GenericErrors>(articleTagsDbId, (articleTagsOption, action, resolve) => {
  let errors = {}
  let returnValue = articleTagsOption as ArticleTag[]
  if (signed(action)) {
    if (action.type === "UpdateArticleTags") {
      returnValue = returnValue.filter(pt => pt.slug !== action.slug || action.tagList.includes(pt.tag))
      returnValue = returnValue.concat(action.tagList.filter(tag => !returnValue.some(pt => pt.slug === action.slug && pt.tag === tag)).map(tag => ({tag, slug: action.slug})))
    }
  } else {
    errors['unauthorized'] = 'to edit article'
  }
  resolve(errors)
  return returnValue
}, getRealtimeState(`conduit-tags-${articlesVersion-1}`), null) // TODO - need to find way to encode types to and from firebase...

export const useTags = () => {
  const [articleTags] = useArticleTags()
  return articleTags && Array.from(new Set(articleTags.map(({tag}) => tag)))
}

function updateArticleTags(payload: {slug: string, tagList: string[]}) {
  return emitWithResponse(articleTagsDbId, {...payload, type: "UpdateArticleTags"})
}

function authorized(payload) {
  return (payload.token === "TODO")
}

//<ArticleFavorite | null, ArticleFavoriteAction, GenericErrors> 
export const useArticleFavorites = () => useRealtimeReducer2({
  name: `conduit-favorites-${articlesVersion}`,
  initialState: getRealtimeState(`conduit-favorites-${articlesVersion-1}`),
  loadingState: null,
  reducer: ({ articles, users }, action, resolve) => {
    if (!authorized(action)) { 
      resolve({errors: {'unauthorized': 'to perform this action'}})
      return { articles, users } 
    }
    
    const { slug, userId } = action
    const favorite = action.type === "FavoriteAction"

    return {
      articles: {
        ...articles,
        [slug]: {
          ...(articles[slug] || {}),
          [userId]: favorite
        }
      },
      users: {
        ...users,
        [userId]: {
          ...(users[userId] || {}),
          [slug]: favorite
        }
      }
    }
  }
})

export const useArticles = ():Article[] => {
  const user = useUser()
  const [articlesDB] = useArticlesDB();
  const [articleTags] = useArticleTags()
  const [articleFavorites] = useArticleFavorites()
  const authors = useProfiles();

  const articles = articlesDB && articleTags && authors && articleFavorites && articlesDB.map(articleDB => ({
    slug: articleDB.slug,
    title: articleDB.title,
    description: articleDB.description,
    body: articleDB.body,
    tagList: articleTags.filter(articleTag => articleTag.slug === articleDB.slug).map(({tag}) => tag),
    createdAt: new Date(articleDB.createdAt),
    updatedAt: new Date(articleDB.updatedAt),
    favorited: user.isSome() && articleFavorites.articles[articleDB.slug] && articleFavorites.articles[articleDB.slug][user.unwrap().publicKey],
    favoritesCount: Object.values(articleFavorites.articles[articleDB.slug] || {}).filter(favorite => favorite).length,
    author: authors.find(u => u.publicKey === articleDB.authorPublicKey),
  }))

  return articles
}
const commentsVersion = articlesVersion + 10
export const useArticleCommentsDB = () => useRealtimeReducer2({
  name: `conduit-comments-${commentsVersion}`,
  initialState: getRealtimeState(`conduit-comments-${articlesVersion-1}`).then(s => s || {}),
  loadingState: null,
  reducer: (comments, action, resolve) => {
    // TODO AUTHORIZATION
    // if (!authorized(action)) { 
    //   resolve({errors: {'unauthorized': 'to perform this action'}})
    //   return comments
    // }
    
    const { slug, userId, commentId } = action

    if (action.type === "CreateComment") {
      const { body, createdAt } = action
      return {
        ...comments,
        [slug]: [
          ...(comments[slug] || []),
          { userId, commentId, body, createdAt }
        ]
      }

    } else if (action.type === "DeleteComment") {
      const comment = comments[slug].find(c => c.commentId === commentId)
      if (comment && comment.userId === action.userId) {
        return {
          ...comments,
          [slug]: [
            ...(comments[slug] || []).filter(c => c.commentId !== commentId),
          ]
        }
      } else {
        // TODO AUTHORIZATION
        return comments
      }
    } else {
      return comments
    }
  }
})

export const useArticleComments = () => {
  const [comments] = useArticleCommentsDB()
  const [users] = useUsers()
  
  return comments && users && Object.fromEntries(Object.entries(comments).map(([slug, comments]) => [
    slug, 
    comments.map(comment => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
      author: users.find(u => u.publicKey === comment.userId)
    }))
  ]))
}