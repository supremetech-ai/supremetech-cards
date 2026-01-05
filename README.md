# Digital Cards Static Site

This is a static site generator for digital business cards. It generates individual HTML files for each card, ensuring rock-solid OG previews for iMessage, Twitter, Facebook, etc.

## How It Works

1. At build time, fetches all active cards from Supabase
2. Generates a static HTML file for each card with proper OG meta tags
3. Deploys to Cloudflare Pages at `cards.yourdomain.com`
4. When someone shares `cards.yourdomain.com/john-doe`, they get perfect previews
5. The HTML page instantly redirects to the full app at `app.yourdomain.com/card/john-doe`

## Setup Instructions

### 1. Create Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click "Create a project" → "Connect to Git"
3. Select this repository (you'll need to push this folder to a separate repo)
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (or `cloudflare-cards-site` if in a subfolder)

### 2. Set Environment Variables

In Cloudflare Pages → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://xgmmfbgoqvfovsyaozfc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key (from Supabase dashboard) |
| `APP_URL` | `https://app.supremetech.contact` |

### 3. Configure Custom Domain

1. Go to Cloudflare Pages → Your project → Custom domains
2. Add `cards.supremetech.contact`
3. Cloudflare will auto-configure DNS if your domain is on Cloudflare

### 4. Set Up Auto-Rebuild Webhook

To automatically rebuild when cards are created/updated, set up a deploy hook:

1. In Cloudflare Pages → Settings → Builds & deployments
2. Copy the "Deploy hook URL" (looks like `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...`)
3. Add this URL as a secret in your Supabase project: `CLOUDFLARE_DEPLOY_HOOK_URL`
4. The `trigger-card-rebuild` edge function will call this webhook

## Testing Locally

```bash
# Install dependencies
npm install

# Set environment variables
export SUPABASE_URL="https://xgmmfbgoqvfovsyaozfc.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export APP_URL="https://app.supremetech.contact"

# Run build
npm run build

# Check output in dist/
ls -la dist/
```

## File Structure

```
dist/
├── index.html          # Redirects to main app
├── 404.html            # Card not found page
├── john-doe.html       # Card for slug "john-doe"
├── jane-smith.html     # Card for slug "jane-smith"
└── ...                 # One file per card
```

## Troubleshooting

### Cards not showing up?
- Ensure the card is active (`is_active = true`)
- Ensure the card has a public slug (`public_slug IS NOT NULL`)

### Preview not updating?
- iMessage caches aggressively - clear cache or share in a new conversation
- Force rebuild in Cloudflare Pages dashboard
- Check that the webhook is triggering rebuilds

### Build failing?
- Check environment variables are set correctly
- Check Cloudflare Pages build logs
