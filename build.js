/**
 * Static Site Generator for Digital Cards (Cloudflare Pages)
 *
 * Generates simple wrapper pages with:
 * - OG meta tags for social sharing previews
 * - An iframe embedding the LIVE card from the main app
 *
 * IMPORTANT:
 * - This script does NOT talk directly to the database.
 * - It fetches card data from EDGE_FUNCTION_URL (Lovable Cloud backend function)
 *   so Cloudflare Pages does not need any secret DB/service keys.
 */

const fs = require('fs');
const path = require('path');

// Bump this whenever you change what HTML gets generated.
// Cloudflare build logs should show this so we can confirm it's using the right script.
const GENERATOR_VERSION = 'wrapper-only-2026-01-11';

const APP_URL = process.env.APP_URL || 'https://app.supremetech.contact';
const CARDS_DOMAIN = process.env.CARDS_DOMAIN || 'https://cards.supremetech.contact';
const EDGE_FUNCTION_URL = process.env.EDGE_FUNCTION_URL;

if (!EDGE_FUNCTION_URL) {
  console.error('Missing EDGE_FUNCTION_URL environment variable');
  process.exit(1);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate the wrapper HTML page for a card
 * Just OG meta tags + iframe to the live card
 */
/**
 * Generate initials-based placeholder image URL for fallback
 * Uses a simple placeholder service with background color from business
 */
function getInitialsPlaceholder(profile, business) {
  const initials = [
    (profile?.first_name || '')[0] || '',
    (profile?.last_name || '')[0] || ''
  ].join('').toUpperCase() || 'U';
  
  // Use business primary color or default blue
  const bgColor = (business?.primary_color || '#3b82f6').replace('#', '');
  
  // Use ui-avatars.com for a simple initials-based image
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColor}&color=fff&size=630&bold=true&length=2`;
}

function generateCardPage(cardData) {
  const { card, profile, business } = cardData;

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name || profile?.last_name || 'Digital Card';

  const title = card.og_title || `${displayName} - ${business?.name || 'Digital Card'}`;
  const description =
    card.og_description ||
    card.custom_bio ||
    profile?.job_title ||
    `Contact ${displayName}`;

  // OG Image fallback chain:
  // 1. Card's custom OG image (explicitly set by user)
  // 2. Card's custom profile photo (from custom_fields)
  // 3. User's avatar (from profile)
  // 4. Business logo (full or standard)
  // 5. Initials-based placeholder with business color
  const customFields = card.custom_fields || {};
  const ogImage = 
    card.og_image_url || 
    customFields.profile_photo_url ||
    profile?.avatar_url || 
    business?.logo_full_url ||
    business?.logo_url || 
    getInitialsPlaceholder(profile, business);
    
  const favicon = business?.logo_icon_url || business?.logo_url || `${APP_URL}/favicon.ico`;

  // The live card URL in the main app (for iframe)
  const liveCardUrlBase = card.public_slug
    ? `${APP_URL}/card/${encodeURIComponent(card.public_slug)}`
    : `${APP_URL}/card?token=${encodeURIComponent(card.public_token)}`;

  // Force embed mode for consistent framing (no app chrome)
  const liveCardUrl = `${liveCardUrlBase}${liveCardUrlBase.includes('?') ? '&' : '?'}embed=1`;

  const canonicalUrl = `${CARDS_DOMAIN}/${card.public_slug}`;
  const buildStamp = process.env.BUILD_STAMP || new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- GENERATED_BY: digital-cards-ssg (iframe) ${buildStamp} -->
  <meta name="generator" content="digital-cards-ssg (iframe)">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">

  <link rel="canonical" href="${canonicalUrl}">

  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">

  <link rel="icon" type="image/png" href="${escapeHtml(favicon)}">

  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{
      width:100%;
      height:100%;
      background:#f5f5f5;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    }
    .card-frame{
      width:100%;
      max-width:430px;
      height:100%;
      max-height:932px;
      border-radius:24px;
      overflow:hidden;
      box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);
    }
    iframe{width:100%;height:100%;border:none;}
    @media(max-width:460px){
      html,body{padding:0;}
      .card-frame{max-width:100%;max-height:100%;border-radius:0;box-shadow:none;}
    }
  </style>
</head>
<body>
  <div class="card-frame">
    <iframe
      src="${liveCardUrl}"
      title="${escapeHtml(displayName)}'s Digital Card"
      allow="clipboard-write"
      loading="eager"
    ></iframe>
  </div>
</body>
</html>`;
}

function generateIndexPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digital Business Cards</title>
  <meta name="description" content="Create and share digital business cards">
  <meta http-equiv="refresh" content="0;url=${APP_URL}">
</head>
<body>
  <p>Redirecting to <a href="${APP_URL}">${APP_URL}</a>...</p>
</body>
</html>`;
}

function generate404Page() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Not Found</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;}
    .container{text-align:center;padding:2rem;}
    h1{margin-bottom:1rem;}
    p{color:#888;margin-bottom:2rem;}
    a{color:#60a5fa;text-decoration:none;}
  </style>
</head>
<body>
  <div class="container">
    <h1>Card Not Found</h1>
    <p>This digital card doesn't exist or has been removed.</p>
    <a href="${APP_URL}">Create your own card →</a>
  </div>
</body>
</html>`;
}

async function fetchCardsForBuild() {
  const res = await fetch(EDGE_FUNCTION_URL, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`EDGE_FUNCTION_URL failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = await res.json();
  if (json?.error) throw new Error(String(json.error));
  return Array.isArray(json?.cards) ? json.cards : [];
}

async function build() {
  console.log('🚀 Starting static card generation...');
  console.log(`GENERATOR_VERSION: ${GENERATOR_VERSION}`);
  console.log(`APP_URL: ${APP_URL}`);
  console.log(`CARDS_DOMAIN: ${CARDS_DOMAIN}`);
  console.log(`EDGE_FUNCTION_URL: ${EDGE_FUNCTION_URL}`);

  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  process.env.BUILD_STAMP = process.env.BUILD_STAMP || new Date().toISOString();
  fs.writeFileSync(
    path.join(distDir, '__build.txt'),
    `digital-cards-ssg (iframe)\nversion: ${GENERATOR_VERSION}\n${process.env.BUILD_STAMP}\n`
  );

  for (const file of ['_headers', '_routes.json']) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, file));
    }
  }

  fs.writeFileSync(path.join(distDir, 'index.html'), generateIndexPage());
  fs.writeFileSync(path.join(distDir, '404.html'), generate404Page());

  let cards = [];
  try {
    cards = await fetchCardsForBuild();
  } catch (err) {
    console.error('Error fetching cards for build:', err);
    console.log('Build completed with index/404 only.');
    return;
  }

  console.log(`Found ${cards.length} cards from EDGE_FUNCTION_URL`);

  for (const cardData of cards) {
    const slug = cardData?.card?.public_slug;
    if (!slug) continue;

    const html = generateCardPage(cardData);

    const cardDir = path.join(distDir, slug);
    fs.mkdirSync(cardDir, { recursive: true });

    fs.writeFileSync(path.join(cardDir, 'index.html'), html);
    fs.writeFileSync(path.join(distDir, `${slug}.html`), html);

    console.log(`✅ Generated: ${slug}/index.html`);
    console.log(`✅ Generated: ${slug}.html`);
  }

  console.log(`\nBuild complete! Generated ${cards.length} card wrapper pages.`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
