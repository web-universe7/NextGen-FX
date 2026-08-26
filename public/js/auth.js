// Small shared helpers used on every page.

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin'
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function getCurrentUser() {
  try {
    return await apiFetch('/api/me');
  } catch (e) {
    return null;
  }
}

async function logout() {
  try { await apiFetch('/api/logout', { method: 'POST' }); } catch (e) {}
  window.location.href = '/login.html';
}

// Fills the top-right of the header depending on login state.
async function renderAuthNav(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const user = await getCurrentUser();
  if (user) {
    el.innerHTML = `
      <a href="/dashboard.html" class="link-btn" style="text-decoration:none;color:#fff;">Hi, ${escapeHtml(user.name.split(' ')[0])}</a>
      <button class="pill-btn secondary" id="navLogoutBtn">Log out</button>
    `;
    document.getElementById('navLogoutBtn').addEventListener('click', logout);
  } else {
    el.innerHTML = `
      <a href="/login.html" class="link-btn" style="text-decoration:none;color:#fff;">Log in</a>
      <a href="/register.html" class="pill-btn">Sign up</a>
    `;
  }
  return user;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Redirects to /login.html if not logged in. Returns the user object.
async function requireLogin() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  return user;
}
