import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import ApplicantPasswordReset from './components/pages/ApplicantPasswordReset';
import { passwordRecoveryClient } from './lib/supabaseClient';
export default function App() {
  return (
    <>
      {passwordRecoveryClient ? (
        <ApplicantPasswordReset client={passwordRecoveryClient} />
      ) : (
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      )}
    </>
  );
}
