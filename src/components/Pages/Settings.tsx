import React, { useState } from 'react';
import { useUser, useUsers } from './../../services/user';
import { buildGenericFormField } from './../../types/genericFormField';
import { GenericForm } from './../GenericForm';
import { ContainerPage } from './../ContainerPage';
import { UserSettings } from '../../types/user';
import { signOut, updateEmail } from 'firebase/auth';
import { firebaseAuth, useFirebaseUser } from '../../services/compose';
import { redirect } from '../../types/location';

export interface SettingsField {
  name: keyof UserSettings;
  type?: string;
  isTextArea?: true;
  placeholder: string;
}

export function Settings() {
  const oldUser = useUser();
  const firebaseUser = useFirebaseUser();
  const [newUser, setUser] = useState(null);
  const [errors, setErrors] = useState({});
  const [updating, setUpdating] = useState(false);

  const user = newUser || (oldUser ? oldUser : {});

  function onUpdateField(name: string, value: string) {
    setUser({ ...user, [name]: value });
  }

  const [, emitUserAction] = useUsers();

  async function onUpdateSettings(ev: React.FormEvent) {
    ev.preventDefault();
    if (!oldUser) {
      return;
    }

    setUpdating(true);

    if (oldUser.email !== newUser.email) {
      updateEmail(firebaseUser, newUser.email);
    }

    const errors = await emitUserAction({
      type: 'UPDATE',
      uid: oldUser.uid,
      newUser: user,
    });
    setUpdating(false);
    if (Object.keys(errors).length) {
      setErrors(errors);
    } else {
      redirect('');
    }
  }

  return (
    <div className='settings-page'>
      <ContainerPage>
        <div className='col-md-6 offset-md-3 col-xs-12'>
          <h1 className='text-xs-center'>Your Settings</h1>

          <GenericForm
            disabled={updating}
            formObject={{ ...user }}
            submitButtonText='Update Settings'
            errors={errors}
            onChange={onUpdateField}
            onSubmit={onUpdateSettings}
            fields={[
              buildGenericFormField({ name: 'image', placeholder: 'URL of profile picture' }),
              buildGenericFormField({ name: 'username', placeholder: 'Your Name' }),
              buildGenericFormField({
                name: 'bio',
                placeholder: 'Short bio about you',
                rows: 8,
                fieldType: 'textarea',
              }),
              buildGenericFormField({ name: 'email', placeholder: 'Email' }),
              buildGenericFormField({ name: 'password', placeholder: 'Password', type: 'password' }),
            ]}
          />

          <hr />
          <button className='btn btn-outline-danger' onClick={() => signOut(firebaseAuth)}>
            Or click here to logout.
          </button>
        </div>
      </ContainerPage>
    </div>
  );
}
