import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { redirect } from '../../types/location';
import { Profile } from '../../types/profile';
import { useFollowers, useProfiles, useUser } from '../../services/user';
import { ArticlesViewer } from '../ArticlesViewer';
import { UserInfo } from '../UserInfo';

export function ProfilePage() {
  const user = useUser();
  const [, emitFollowAction] = useFollowers();
  const [submittingFollow, setSubmittingFollow] = useState(false);

  const { username } = useParams<{ username: string }>();
  const favorites = useLocation().pathname.endsWith('favorites');

  const profiles = useProfiles();
  const profile = profiles && profiles.find((u) => u.username === username);

  async function onFollowToggle(profile: Profile) {
    if (!user) {
      redirect('register');
      return;
    }

    setSubmittingFollow(true);

    await emitFollowAction({
      type: profile.following ? 'UnfollowAction' : 'FollowAction',
      follower: user.uid,
      leader: profile.uid,
      uid: user.uid,
    });

    setSubmittingFollow(false);
  }

  return (
    <div className='profile-page'>
      {profile ? (
        <UserInfo
          user={profile}
          disabled={submittingFollow}
          onFollowToggle={() => onFollowToggle(profile)}
          onEditSettings={() => redirect('settings')}
        />
      ) : (
        <div className='article-preview' key={1}>
          Loading profile...
        </div>
      )}
      <div className='container'>
        <div className='row'>
          <div className='col-xs-12 col-md-10 offset-md-1'>
            <ArticlesViewer
              toggleClassName='articles-toggle'
              tabs={['My Articles', 'Favorited Articles']}
              selectedTab={favorites ? 'Favorited Articles' : 'My Articles'}
              onTabChange={onTabChange(username)}
              uid={profile && profile.uid}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function onTabChange(username: string): (page: string) => void {
  return async (page) => {
    const favorited = page === 'Favorited Articles';
    redirect(`profile/${username}${!favorited ? '' : 'favorites'}`);
  };
}
