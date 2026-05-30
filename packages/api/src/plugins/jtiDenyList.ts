const denied = new Set<string>();

export const jtiDenyList = {
  add: (jti: string) => denied.add(jti),
  has: (jti: string) => denied.has(jti),
};
