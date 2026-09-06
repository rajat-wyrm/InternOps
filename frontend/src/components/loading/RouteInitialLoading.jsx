import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import useAuthStore from '../../store/auth';
import RouteRefreshSkeleton from './RouteRefreshSkeleton';

const RouteInitialLoadingContext = createContext(null);

export function useRouteInitialLoading(loading) {
  const reportLoading = useContext(RouteInitialLoadingContext);

  useLayoutEffect(() => {
    if (!reportLoading) return;

    reportLoading(Boolean(loading));
  }, [loading, reportLoading]);
}

export default function RouteInitialLoading({ animate, children }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const [pageLoading, setPageLoading] = useState(true);

  const reportLoading = useCallback((loading) => {
    setPageLoading(Boolean(loading));
  }, []);

  const loading = !hydrated || pageLoading;

  return (
    <RouteInitialLoadingContext.Provider value={reportLoading}>
      {loading ? <RouteRefreshSkeleton /> : null}

      <div
        aria-hidden={loading || undefined}
        className={
          loading ? 'hidden' : animate ? 'animate-fade-in-up' : undefined
        }
      >
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </RouteInitialLoadingContext.Provider>
  );
}
