import React, { useState } from 'react';
import { getKeyPair, sign, UserSettings, useUser, useUsers } from './../../services/user';
import { buildGenericFormField } from './../../types/genericFormField';
import { GenericForm } from './../GenericForm';
import { ContainerPage } from './../ContainerPage';

export interface SettingsField {
  name: keyof UserSettings;
  type?: string;
  isTextArea?: true;
  placeholder: string;
}

export function Settings() {
  const oldUser = useUser()
  const [newUser, setUser] = useState(null)
  const [errors, setErrors] = useState({})
  const [updating, setUpdating] = useState(false)


  const user = newUser || (oldUser.isNone() ? {} : oldUser.unwrap())
  
  function onUpdateField(name: string, value: string) {
    setUser({... user, [name]: value })
  }

  const keypair = getKeyPair()  
  const [, emitUserAction] = useUsers()

  async function onUpdateSettings(ev: React.FormEvent) {
    ev.preventDefault();
    setUpdating(true)
    if (keypair.isSome()) {
      const errors = await emitUserAction(sign(keypair.unwrap().privateKey, {
        type: "UPDATE",
        publicKey: keypair.unwrap().publicKey,
        newUser: {
          ...user,
          publicKey: keypair.unwrap().publicKey
        }
      }))
      setUpdating(false)
      if (Object.keys(errors).length) {
        setErrors(errors)
      } else {
        location.hash = '/';
      }

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
          <button className='btn btn-outline-danger' onClick={_logout}>
            Or click here to logout.
          </button>
        </div>
      </ContainerPage>
    </div>
  );
}

function _logout() {
  localStorage.removeItem('keypair');
  location.hash = '/';
}