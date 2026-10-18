/** Вход кабинета из замка (scripts/lock-admin.mjs) – Basic-авторизация к серверу (заявки, боевой режим).
    Один логин и пароль на кабинет и сервер – правило кабинета-стандарта 17.10.2026. */
export function adminAuth(): string {
  try {
    const a = JSON.parse(sessionStorage.getItem('gm_admin_auth') || localStorage.getItem('gm_admin_keep') || 'null');
    return a ? 'Basic ' + btoa(unescape(encodeURIComponent(`${a.login}:${a.pass}`))) : '';
  } catch { return ''; }
}
