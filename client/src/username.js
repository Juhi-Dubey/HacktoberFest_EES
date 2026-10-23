const KEY = 'codearena-username';

export function getUsername() {
  return localStorage.getItem(KEY) || '';
}

export function setUsername(name) {
  localStorage.setItem(KEY, name.trim());
}
