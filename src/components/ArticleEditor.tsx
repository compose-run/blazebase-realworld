import { uniq } from 'ramda';
import { useState } from 'react';
import { ArticleForEditor } from '../types/article';
import { GenericErrors } from './../types/error';
import { buildGenericFormField } from './../types/genericFormField';
import { ContainerPage } from './ContainerPage';
import { GenericForm } from './GenericForm';

export function ArticleEditor({
  onSubmit,
  submitting,
  article,
  errors,
}: {
  onSubmit: (newArticle: ArticleForEditor) => void;
  submitting: boolean;
  article?: ArticleForEditor;
  errors: GenericErrors;
}) {
  const [currentArticle, setCurrentArticle] = useState(
    article || { title: '', body: '', description: '', tagList: [] }
  );
  const [tagTextbox, setTagTextbox] = useState('');

  function onUpdateField(name: string, value: string) {
    if (name === 'tag') {
      setTagTextbox(value);
    } else if (name !== 'tagList') {
      setCurrentArticle({
        ...currentArticle,
        [name]: value,
      });
    }
  }

  function onAddTag() {
    setCurrentArticle({
      ...currentArticle,
      tagList: uniq(currentArticle.tagList.concat([tagTextbox])),
    });
    setTagTextbox('');
  }

  function onRemoveTag(_: string, index: number) {
    setCurrentArticle({
      ...currentArticle,
      tagList: currentArticle.tagList.filter((_, i) => i !== index),
    });
  }

  return (
    <div className='editor-page'>
      <ContainerPage>
        <div className='col-md-10 offset-md-1 col-xs-12'>
          <GenericForm
            formObject={{ ...currentArticle, tag: tagTextbox } as unknown as Record<string, string | null>}
            disabled={submitting}
            errors={errors}
            onChange={onUpdateField}
            onSubmit={(ev) => {
              ev.preventDefault();
              onSubmit(currentArticle);
            }}
            submitButtonText='Publish Article'
            onAddItemToList={onAddTag}
            onRemoveListItem={onRemoveTag}
            fields={[
              buildGenericFormField({ name: 'title', placeholder: 'Article Title' }),
              buildGenericFormField({ name: 'description', placeholder: "What's this article about?", lg: false }),
              buildGenericFormField({
                name: 'body',
                placeholder: 'Write your article (in markdown)',
                fieldType: 'textarea',
                rows: 8,
                lg: false,
              }),
              buildGenericFormField({
                name: 'tag',
                placeholder: 'Enter Tags',
                listName: 'tagList',
                fieldType: 'list',
                lg: false,
              }),
            ]}
          />
        </div>
      </ContainerPage>
    </div>
  );
}
