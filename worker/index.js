export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '').replace(/^\/.auth/, ''); // Remove /.auth prefix if present

    const ADMIN_URL = env.ADMIN_URL || 'https://fardinahamed.tech/admin/index.html';
    const CLIENT_ID = env.GITHUB_CLIENT_ID;
    const CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;

    function makeState(length = 32) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    }

    if (pathname === '/auth/start') {
      if (!CLIENT_ID) return new Response('Missing GITHUB_CLIENT_ID', { status: 500 });
      const state = makeState();
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: `${url.origin}/.auth/auth/callback`,
        scope: 'repo',
        state
      });
      const redirect = `https://github.com/login/oauth/authorize?${params.toString()}`;
      const res = Response.redirect(redirect, 302);
      // set state cookie for CSRF
      res.headers.set('Set-Cookie', `__gh_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`);
      return res;
    }

    if (pathname === '/auth/callback') {
      const params = url.searchParams;
      const code = params.get('code');
      const state = params.get('state');
      // verify cookie
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/__gh_oauth_state=([^;]+)/);
      const saved = match ? match[1] : null;
      if (!code || !state || !saved || state !== saved) {
        return new Response('Invalid OAuth state', { status: 400 });
      }

      if (!CLIENT_ID || !CLIENT_SECRET) return new Response('Missing GitHub OAuth secrets', { status: 500 });

      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: `${url.origin}/.auth/auth/callback`, state })
      });
      const tokenJson = await tokenRes.json();
      const access_token = tokenJson.access_token;
      if (!access_token) {
        return new Response('Failed to obtain access token', { status: 502 });
      }

      // Redirect back to admin with token in fragment so it isn't sent to server
      const redirectUrl = `${ADMIN_URL}#token=${encodeURIComponent(access_token)}`;
      return Response.redirect(redirectUrl, 302);
    }

    return new Response('Not Found', { status: 404 });
  }
};
