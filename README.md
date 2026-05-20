# gift-draw

Tiny secret-santa-style web app. Host creates a "hat", everyone joins via link
and fills in their own name + email, host clicks draw, everyone gets emailed
their pick.

## Running locally

```
npm install
GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=xxxx npm start
```

Then open http://localhost:3000. With `GMAIL_*` unset, emails are logged to
stdout instead of sent.

Redis is optional locally; it defaults to `redis://127.0.0.1:6379`. Start one
with `docker run --rm -p 6379:6379 redis:7-alpine` or set `REDIS_URL`.

## Deploy

CI in `.github/workflows/deploy.yml` builds and pushes the image to GHCR via
the reusable workflow in `jackowfish/server-utilities`. Flux in that repo's
`k8s/apps/gift-draw/` picks up the new tag and rolls the deployment.
