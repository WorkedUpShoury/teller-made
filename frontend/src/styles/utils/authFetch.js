export function authFetch(path, init = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...(init.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { ...init, headers });
}
