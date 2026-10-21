import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Maps a backend user role to its canonical portal identifier.
 */
export function getPortalForRole(role) {
  const r = (role || '').toUpperCase();
  if (r.startsWith('ORG_') || r === 'EMPLOYER_ADMIN' || r === 'ORGANIZATION') return 'ORG';
  if (r.startsWith('MERCHANT') || r === 'MERCHANT_OWNER' || r === 'MERCHANT_STAFF' || r === 'MERCHANT_ADMIN') return 'MERCHANT';
  if (r === 'EMPLOYEE' || r === 'WORKER') return 'EMPLOYEE';
  if (r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'FLEXPAY_ADMIN') return 'ADMIN';
  return null;
}

/**
 * Determines the portal identifier from the browser window path.
 */
export function getPortalForPath(pathname = (typeof window !== 'undefined' ? window.location.pathname : '')) {
  if (pathname.startsWith('/org')) return 'ORG';
  if (pathname.startsWith('/merchant')) return 'MERCHANT';
  if (pathname.startsWith('/employee') || pathname.startsWith('/worker')) return 'EMPLOYEE';
  if (pathname.startsWith('/admin')) return 'ADMIN';
  return null;
}

const DEFAULT_SESSIONS = {
  ORG: { user: null, accessToken: null },
  MERCHANT: { user: null, accessToken: null },
  EMPLOYEE: { user: null, accessToken: null },
  ADMIN: { user: null, accessToken: null },
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // Multi-portal session registry: isolated slots per portal persona
      sessions: { ...DEFAULT_SESSIONS },

      // Active pointers (for legacy/un-scoped component consumers)
      user: null,
      accessToken: null,

      /**
       * Stores credentials into the portal-specific slot and updates active pointers.
       * Does NOT overwrite credentials belonging to other portals.
       */
      setAuth: (user, accessToken, portalOverride = null) => {
        const portal =
          portalOverride ||
          getPortalForRole(user?.role) ||
          getPortalForPath() ||
          'EMPLOYEE';

        const currentSessions = get().sessions || { ...DEFAULT_SESSIONS };
        const updatedSessions = {
          ...currentSessions,
          [portal]: { user, accessToken },
        };

        set({
          sessions: updatedSessions,
          user,
          accessToken,
        });
      },

      /**
       * Resolves the session for a specific portal, falling back to active pointers if needed.
       */
      getSessionForPortal: (portalHint = null) => {
        const portal = portalHint || getPortalForPath();
        const currentSessions = get().sessions || {};

        if (portal && currentSessions[portal]?.accessToken && currentSessions[portal]?.user) {
          return currentSessions[portal];
        }

        // Check if top-level user matches the target portal
        const topUser = get().user;
        const topToken = get().accessToken;
        if (topUser && topToken) {
          const topPortal = getPortalForRole(topUser.role);
          if (!portal || topPortal === portal) {
            return { user: topUser, accessToken: topToken };
          }
        }

        return { user: null, accessToken: null };
      },

      /**
       * Returns the access token scoped to the target portal.
       */
      getTokenForPortal: (portalHint = null) => {
        const session = get().getSessionForPortal(portalHint);
        return session?.accessToken || get().accessToken || null;
      },

      /**
       * Updates the access token for the target portal without clearing other portals.
       */
      setAccessToken: (accessToken, portalOverride = null) => {
        const portal = portalOverride || getPortalForPath();
        const currentSessions = get().sessions || { ...DEFAULT_SESSIONS };

        if (portal && currentSessions[portal]) {
          const updatedSessions = {
            ...currentSessions,
            [portal]: {
              ...currentSessions[portal],
              accessToken,
            },
          };
          set({ sessions: updatedSessions, accessToken });
        } else {
          set({ accessToken });
        }
      },

      /**
       * Clears authentication only for the specified portal (or active route portal),
       * ensuring other tabs running other portals remain signed in.
       */
      clearAuth: (portalOverride = null) => {
        const portal = portalOverride || getPortalForPath();
        const currentSessions = get().sessions || { ...DEFAULT_SESSIONS };

        if (portal && currentSessions[portal]) {
          const updatedSessions = {
            ...currentSessions,
            [portal]: { user: null, accessToken: null },
          };

          // Find another remaining active session if available
          const remainingPortals = Object.keys(updatedSessions).filter(
            (p) => updatedSessions[p]?.accessToken && updatedSessions[p]?.user
          );

          const nextSession =
            remainingPortals.length > 0
              ? updatedSessions[remainingPortals[0]]
              : { user: null, accessToken: null };

          set({
            sessions: updatedSessions,
            user: nextSession.user,
            accessToken: nextSession.accessToken,
          });
        } else {
          // If un-scoped, clear everything
          set({
            sessions: { ...DEFAULT_SESSIONS },
            user: null,
            accessToken: null,
          });
        }
      },

      /**
       * Explicitly signs out of all portals globally.
       */
      clearAllAuth: () => {
        set({
          sessions: { ...DEFAULT_SESSIONS },
          user: null,
          accessToken: null,
        });
      },
    }),
    {
      name: 'flexpay-auth-v2',
      partialize: (state) => ({
        sessions: state.sessions,
        user: state.user,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Auto-migrate legacy 'flexpay-auth' localStorage item if sessions are empty
        if (
          state.user &&
          state.accessToken &&
          (!state.sessions || Object.values(state.sessions).every((s) => !s?.accessToken))
        ) {
          const portal = getPortalForRole(state.user.role) || 'EMPLOYEE';
          state.sessions = {
            ...DEFAULT_SESSIONS,
            [portal]: { user: state.user, accessToken: state.accessToken },
          };
        }
      },
    }
  )
);
