Cloudflare Worker for GitHub OAuth used by Sveltia admin

Endpoints:
- /auth/start -> Redirects user to GitHub OAuth authorize page and sets a state cookie
- /auth/callback -> Exchanges code for access token and redirects back to admin with token in URL fragment

Setup:
1. Create a GitHub OAuth App (https://github.com/settings/developers)
   - Authorization callback URL: https://<your-worker-domain>/auth/callback
2. Set the following Wrangler secrets for the worker:
   - GITHUB_CLIENT_ID
   - GITHUB_CLIENT_SECRET
   - ADMIN_URL (optional) e.g. https://fardinahamed.tech/admin/index.html

Deploy with Wrangler or Cloudflare Pages functions.
