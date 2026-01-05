// cloudflare-cards-site/build.js
const fs = require('fs');
const path = require('path');

// Environment variables
const EDGE_FUNCTION_URL = process.env.EDGE_FUNCTION_URL;
const APP_URL = process.env.APP_URL || 'https://app.supremetech.contact';

if (!EDGE_FUNCTION_URL) {
  console.error('Error: EDGE_FUNCTION_URL environment variable is required');
  process.exit(1);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function applyTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

function generateHTML(card, profile, business, template) {
  const name = profile?.full_name || 'Digital Card';
  const title = profile?.job_title || '';
  const company = business?.name || '';
  const description = title && company 
    ? `${title} at ${company}` 
    : title || company || 'View my digital business card';
  
  // Get OG image URL
  const ogImageUrl = `${EDGE_FUNCTION_URL}/generate-card-qr?slug=${card.slug}&format=og`;
  
  // Template settings for customization
  const settings = template?.settings || {};
  const titleTemplate = settings.og_title_template || '{{name}} - Digital Card';
  const descTemplate = settings.og_description_template || '{{title}} at {{company}}';
  
  const ogTitle = applyTemplate(titleTemplate, { name, title, company });
  const ogDescription = applyTemplate(descTemplate, { name, title, company, description });
  
  const cardUrl = `${APP_URL}/c/${card.slug}`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ogTitle)}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(cardUrl)}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(cardUrl)}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
  
  <!-- Redirect to the actual app -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(cardUrl)}">
  <link rel="canonical" href="${escapeHtml(cardUrl)}">
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(cardUrl)}">${escapeHtml(name)}'s digital card</a>...</p>
</body>
</html>`;
}

async function build() {
  console.log('Starting Cloudflare Cards static site build...');
  console.log(`Edge Function URL: ${EDGE_FUNCTION_URL}`);
  console.log(`App URL: ${APP_URL}`);
  
  // Create dist directory
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  try {
    // Fetch cards data from edge function
    console.log('Fetching cards data from edge function...');
    const response = await fetch(`${EDGE_FUNCTION_URL}/get-cards-for-static-build`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch cards: ${response.status} ${response.statusText}`);
    }
    
    const { cards, error } = await response.json();
    
    if (error) {
      throw new Error(`Edge function error: ${error}`);
    }
    
    console.log(`Found ${cards?.length || 0} active cards with slugs`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Generate HTML files for each card
    for (const cardData of (cards || [])) {
      const { card, profile, business, template } = cardData;
      
      if (!card?.slug) {
        console.warn('Skipping card without slug');
        errorCount++;
        continue;
      }
      
      try {
        const html = generateHTML(card, profile, business, template);
        const filePath = path.join(distDir, `${card.slug}.html`);
        fs.writeFileSync(filePath, html);
        console.log(`Generated: ${card.slug}.html`);
        successCount++;
      } catch (err) {
        console.error(`Error generating ${card.slug}: ${err.message}`);
        errorCount++;
      }
    }
    
    // Create index.html that redirects to main app
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digital Cards</title>
  <meta http-equiv="refresh" content="0;url=${APP_URL}">
</head>
<body>
  <p>Redirecting to <a href="${APP_URL}">the app</a>...</p>
</body>
</html>`;
    fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
    
    // Create 404.html
    const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Card Not Found</title>
  <meta http-equiv="refresh" content="3;url=${APP_URL}">
</head>
<body>
  <h1>Card Not Found</h1>
  <p>Redirecting to <a href="${APP_URL}">the app</a>...</p>
</body>
</html>`;
    fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml);
    
    console.log('\n=== Build Summary ===');
    console.log(`Successfully generated: ${successCount} cards`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total files: ${successCount + 2} (including index.html and 404.html)`);
    
  } catch (err) {
    console.error('Build failed:', err.message);
    process.exit(1);
  }
}

build();
