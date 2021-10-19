import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { buildGenericFormField } from './../../types/genericFormField';
import { GenericForm } from './../GenericForm';
import { ContainerPage } from './../ContainerPage';
import { firebaseAuth } from '../../services/compose';
import { redirect } from '../../types/location';
import { Link } from 'react-router-dom';

export function Login() {
  const [loggingIn, setLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  async function signIn(ev: React.FormEvent) {
    ev.preventDefault();

    setLoggingIn(true);

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      redirect('');
    } catch (e) {
      setErrors({ login: e.message });
      setLoggingIn(false);
    }

    setLoggingIn(false);
  }

  function onUpdateField(name: string, value: string) {
    if (name === 'email') {
      setEmail(value);
    } else if (name === 'password') {
      setPassword(value);
    }
  }

  return (
    <div className='auth-page'>
      <ContainerPage>
        <div className='col-md-6 offset-md-3 col-xs-12'>
          <h1 className='text-xs-center'>Sign in</h1>
          <p className='text-xs-center'>
            <Link to='/#/register'>Need an account?</Link>
          </p>

          <GenericForm
            disabled={loggingIn}
            formObject={{ email, password }}
            submitButtonText='Sign in'
            errors={errors}
            onChange={onUpdateField}
            onSubmit={signIn}
            fields={[
              buildGenericFormField({ name: 'email', placeholder: 'Email' }),
              buildGenericFormField({ name: 'password', placeholder: 'Password', type: 'password' }),
            ]}
          />
        </div>
      </ContainerPage>
    </div>
  );
}
