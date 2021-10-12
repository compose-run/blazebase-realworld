import { useState } from 'react';
import { ArticleForEditor } from './../../types/article';
import { useArticlesDB } from './../../services/article';
import { useUser } from './../../services/user';
import { ArticleEditor } from './../ArticleEditor';
import { redirect } from '../../types/location';
import slugify from 'slugify';

export function NewArticle() {
  const user = useUser();
  const [, emitArticleAction] = useArticlesDB();

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  async function onSubmit(newArticle: ArticleForEditor) {
    setSubmitting(true);
    try {
      const { errors, slug } = await emitArticleAction({
        type: 'CreateArticleAction',
        article: newArticle,
        createdAt: Date.now(),
        uid: user.uid,
        slug: generateSlug(newArticle.title),
      });

      setSubmitting(false);

      if (errors) {
        setErrors(errors);
      } else {
        redirect(`article/${slug}`);
      }
    } catch (e) {
      setErrors({ 'unknown network error': e.message });
    }
  }

  return <ArticleEditor onSubmit={onSubmit} errors={errors} submitting={submitting} />;
}

function generateSlug(title) {
  return slugify(title, { remove: /[^\w\s-]/g }) + '-' + ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
}
