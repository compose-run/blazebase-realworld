import { Fragment, useState } from 'react';
import { classObjectToClassName } from './../types/style';
import { useFollowers, useUser } from './../services/user';
import { ArticlePreview } from './ArticlePreview';
import { Pagination } from './Pagination';
import { useArticleFavorites, useArticles } from '../services/article';

export function ArticlesViewer({
  toggleClassName,
  tabs,
  selectedTab,
  onTabChange,
  uid,
}: {
  toggleClassName: string;
  tabs: string[];
  selectedTab: string;
  onTabChange?: (tab: string) => void;
  uid?: string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const user = useUser();
  const articles = useArticles();
  const [following] = useFollowers();
  const [favorites] = useArticleFavorites();

  const feedArticles =
    articles &&
    articles
      .filter(
        (article) =>
          selectedTab === 'Global Feed' ||
          (selectedTab === 'Your Feed' && user && following[user.uid] && following[user.uid][article.author.uid]) ||
          (selectedTab === 'My Articles' && article.author.uid === uid) ||
          (selectedTab === 'Favorited Articles' && favorites.users[uid] && favorites.users[uid][article.slug])
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const pageArticles = feedArticles && feedArticles.slice((currentPage - 1) * 10, currentPage * 10);
  const articlesCount = feedArticles ? feedArticles.length : 0;

  return (
    <Fragment>
      <ArticlesTabSet {...{ tabs, selectedTab, toggleClassName, onTabChange }} />
      <ArticleList articles={pageArticles} />
      <Pagination currentPage={currentPage} count={articlesCount} itemsPerPage={10} onPageChange={setCurrentPage} />
    </Fragment>
  );
}

function ArticlesTabSet({
  tabs,
  toggleClassName,
  selectedTab,
  onTabChange,
}: {
  tabs: string[];
  toggleClassName: string;
  selectedTab: string;
  onTabChange?: (tab: string) => void;
}) {
  return (
    <div className={toggleClassName}>
      <ul className='nav nav-pills outline-active'>
        {tabs.map((tab) => (
          <Tab key={tab} tab={tab} active={tab === selectedTab} onClick={() => onTabChange && onTabChange(tab)} />
        ))}
      </ul>
    </div>
  );
}

function Tab({ tab, active, onClick }: { tab: string; active: boolean; onClick: () => void }) {
  return (
    <li className='nav-item'>
      <a
        className={classObjectToClassName({ 'nav-link': true, active })}
        href='#'
        onClick={(ev) => {
          ev.preventDefault();
          onClick();
        }}
      >
        {tab}
      </a>
    </li>
  );
}

function ArticleList({ articles }) {
  return articles ? (
    <Fragment>
      {articles.length === 0 && (
        <div className='article-preview' key={1}>
          No articles are here... yet.
        </div>
      )}
      {articles.map((article) => (
        <ArticlePreview key={article.slug} article={article} />
      ))}
    </Fragment>
  ) : (
    <div className='article-preview' key={1}>
      Loading articles...
    </div>
  );
}
