async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let data;
    try {
      data = await res.json();
    } catch {
      // response is not JSON
    }
    if (res.status === 429) {
      if (data?.error) {
        throw new Error(data.error);
      }
      const retryHeader = res.headers.get('Retry-After');
      const seconds = retryHeader ? parseInt(retryHeader, 10) : 600;
      const minutes = Math.max(1, Math.ceil((Number.isNaN(seconds) ? 600 : seconds) / 60));
      throw new Error(`Too many attempts, try again in ${minutes} minute${minutes === 1 ? '' : 's'}`);
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  problems: () => request('/api/problems'),
  problem: (slug) => request(`/api/problems/${slug}`),
  submissions: (slug, username) =>
    request(`/api/submissions?slug=${encodeURIComponent(slug)}&username=${encodeURIComponent(username)}`),
  submit: (body) => request('/api/submissions', { method: 'POST', body: JSON.stringify(body) }),
  leaderboard: () => request('/api/leaderboard'),
  me: () => request('/api/auth/me'),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
};
