export function publicUser(user) {
  if (!user) return null;
  const { password_hash, reset_token_hash, reset_token_expires, ...rest } = user;
  return rest;
}
