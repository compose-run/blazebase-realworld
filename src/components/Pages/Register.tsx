import { createUserWithEmailAndPassword } from 'firebase/auth';
import { buildGenericFormField } from './../../types/genericFormField';
import { GenericForm } from './../GenericForm';
import { useUsers } from './../../services/user';
import { ContainerPage } from './../ContainerPage';
import { useState } from 'react';
import { firebaseAuth } from '../../services/compose';
import { redirect } from '../../types/location';
import { Link } from 'react-router-dom';

export function Register() {
  const [errors, setErrors] = useState({});
  const [signingUp, setSigningUp] = useState(false);
  const [user, setUser] = useState({ username: '', email: '', password: '' });

  const [, emitUserAction] = useUsers();

  function onUpdateField(name: string, value: string) {
    setUser({ ...user, [name]: value });
  }

  async function onSignUp(ev: React.FormEvent) {
    ev.preventDefault();
    setSigningUp(true);

    try {
      const {
        user: { uid },
      } = await createUserWithEmailAndPassword(firebaseAuth, user.email, user.password);
      const errors = await emitUserAction({
        type: 'SIGN_UP',
        user: {
          username: user.username,
          email: user.email,
          uid,
          bio: null,
          image: null,
        },
      });

      if (Object.keys(errors).length) {
        setErrors(errors);
      } else {
        redirect('');
      }
    } catch (e) {
      setErrors({ register: [e.message] });
    }

    setSigningUp(false);
  }

  return (
    <div className='auth-page'>
      <ContainerPage>
        <div className='col-md-6 offset-md-3 col-xs-12'>
          <h1 className='text-xs-center'>Sign up</h1>
          <p className='text-xs-center'>
            <Link to='login'>Have an account?</Link>
          </p>

          <GenericForm
            disabled={signingUp}
            formObject={user as unknown as Record<string, string>}
            submitButtonText='Sign up'
            errors={errors}
            onChange={onUpdateField}
            onSubmit={onSignUp}
            fields={[
              buildGenericFormField({ name: 'username', placeholder: 'Username' }),
              buildGenericFormField({ name: 'email', placeholder: 'Email' }),
              buildGenericFormField({ name: 'password', placeholder: 'Password', type: 'password' }),
            ]}
          />
        </div>
      </ContainerPage>
    </div>
  );
}
