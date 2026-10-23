export function publicUser(user) {
  if (!user) return null;
  const { password_hash, reset_token_hash, reset_token_expires, whatsapp_link_code, whatsapp_link_expires, ...rest } = user;
  return rest;
}
