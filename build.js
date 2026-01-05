/**
 * Static Site Generator for Digital Cards
 * 
 * This script fetches all active digital cards from Supabase and generates
 * static HTML files for each one. These files are served by Cloudflare Pages
 * at cards.yourdomain.com/[slug]
 * 
 * Run: npm run build
 * Output: dist/[slug].html for each card
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Environment variables (set in Cloudflare Pages dashboard)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || 'https://app.supremetech.contact';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// HTML template for each card
function generateHTML(card, profile, business, template) {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Contact';
  const jobTitle = profile?.job_title || '';
  const companyName = business?.name || '';
  
  // Use card-level OG overrides, then template settings, then defaults
  const ogTitle = applyTemplate(
    card.og_title || template?.og_title_template || '{{full_name}} - Digital Card',
    { full_name: fullName, job_title: jobTitle, company_name: companyName }
  );
  
  const ogDescription = applyTemplate(
    card.og_description || template?.og_description_template || '{{job_title}} at {{company_name}}',
    { full_name: fullName, job_title: jobTitle, company_name: companyName }
  );
  
  const ogImage = card.og_image_url || template?.og_image_url || profile?.avatar_url || business?.logo_url || `${APP_URL}/og-free-card.png`;
  
  const slug = card.public_slug || card.public_token;
  const canonicalUrl = `https://cards.supremetech.contact/${slug}`;
  const redirectUrl = `${APP_URL}/card/${card.public_slug || `?token=${card.public_token}`}`;
  
  // Theme color from template or business
  const themeColor = template?.color_scheme?.primary || business?.primary_color || '#000000';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="title" content="${escapeHtml(ogTitle)}">
  <meta name="description" content="${escapeHtml(ogDescription)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${escapeHtml(companyName || 'Digital Card')}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  
  <!-- Additional Meta -->
  <meta name="theme-color" content="${themeColor}">
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Instant redirect for humans -->
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .loading {
      text-align: center;
      color: #666;
    }
    a {
      color: ${themeColor};
    }
  </style>
</head>
<body>
  <div class="loading">
    <p>Loading ${escapeHtml(fullName)}'s card...</p>
    <p><a href="${redirectUrl}">Click here if not redirected</a></p>
  </div>
  <script>window.location.href = "${redirectUrl}";</script>
</body>
</html>`;
}

function applyTemplate(template, variables) {
  if (!template) return '';
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result.trim();
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

async function build() {
  console.log('🚀 Starting static card generation...');
  
  // Create dist directory
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Fetch all active cards with slugs
  const { data: cards, error: cardsError } = await supabase
    .from('digital_cards')
    .select('*')
    .eq('is_active', true)
    .not('public_slug', 'is', null);
  
  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    process.exit(1);
  }
  
  console.log(`📇 Found ${cards.length} active cards with slugs`);
  
  let generated = 0;
  let errors = 0;
  
  for (const card of cards) {
    try {
      // Fetch profile data
      const { data: profile } = await supabase
        .rpc('get_public_card_profile', {
          _user_id: card.user_id,
          _business_id: card.business_id
        })
        .maybeSingle();
      
      // Fetch business data
      const { data: business } = await supabase
        .rpc('get_public_business_branding', {
          _business_id: card.business_id
        })
        .maybeSingle();
      
      // Fetch template data
      const { data: template } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', card.template_id)
        .maybeSingle();
      
      // Generate HTML
      const html = generateHTML(card, profile, business, template);
      
      // Write to file
      const filename = `${card.public_slug}.html`;
      fs.writeFileSync(path.join(distDir, filename), html);
      
      console.log(`✅ Generated: ${filename}`);
      generated++;
    } catch (err) {
      console.error(`❌ Error generating ${card.public_slug}:`, err.message);
      errors++;
    }
  }
  
  // Generate index.html (redirect to main app)
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${APP_URL}">
  <title>Digital Cards</title>
</head>
<body>
  <p>Redirecting to <a href="${APP_URL}">${APP_URL}</a>...</p>
</body>
</html>`;
  
  fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
  
  // Generate 404.html
  const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Not Found</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { color: #333; }
    p { color: #666; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Card Not Found</h1>
    <p>This digital card doesn't exist or has been deactivated.</p>
    <p><a href="${APP_URL}">Go to main site</a></p>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml);
  
  console.log(`\n📊 Summary: ${generated} generated, ${errors} errors`);
  console.log('✨ Build complete!');
}

build().catch(console.error);
