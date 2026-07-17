function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get appPin() {
    return required("APP_PIN");
  },
  /** Opt-in SQL statement + duration logging (bonus "query logging"). */
  get logQueries() {
    const value = process.env.QUERY_LOG;
    return value === "1" || value === "true";
  },
};
