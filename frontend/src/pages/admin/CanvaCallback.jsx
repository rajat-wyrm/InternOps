import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function CanvaCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      window.location.href = `/api/v1/canva/auth/callback?error=${encodeURIComponent(error)}`;
      return;
    }

    if (!code) {
      window.location.href = '/admin/canva-templates?error=no_code';
      return;
    }

    const params = new URLSearchParams({
      code,
    });

    if (state) {
      params.set('state', state);
    }

    window.location.href = `/api/v1/canva/auth/callback?${params.toString()}`;
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          Connecting to Canva...
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Please wait while we complete the connection.
        </p>
      </div>
    </div>
  );
}

export default CanvaCallback;
