import { Fragment, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useArticles, useArticlesDB } from '../../services/article';
import { useUser } from '../../services/user';
import { ArticleEditor } from '../ArticleEditor';

export function EditArticle() {
  const { slug } = useParams<{ slug: string }>();
  const user = useUser();

  const [, emitArticlesAction] = useArticlesDB()

  const articles = useArticles()
  const article = articles && articles.find(a => a.slug === slug)

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  if (article && user && article.author.uid !== user.uid) {
    location.hash = '#/';
    return;
  }

  async function onSubmit(newArticle) {
    setSubmitting(true)

    if (!user) { location.hash = '#/'; }

  
    const { errors } = await emitArticlesAction({
      type: "UpdateArticleAction",
      article: newArticle,
      slug,
      uid: user.uid,
      updatedAt: Date.now()
    })

    setSubmitting(false)

    if (errors) {
      setErrors(errors)
    } else {
      location.hash = `#/article/${slug}`;
    }
    
  }

  return <Fragment>
    {article && 
      <ArticleEditor 
        onSubmit={onSubmit} 
        submitting={submitting} 
        article={article}
        errors={errors}
      />}
    </Fragment>;
}

