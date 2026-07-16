/** Exported so client fetches and route files can't drift apart. */
export const API_PATHS = {
  meta: "/api/meta",
  query: "/api/query",
  occupancyLatest: "/api/occupancy/latest",
  authLogin: "/api/auth/login",
  authLogout: "/api/auth/logout",
} as const;
