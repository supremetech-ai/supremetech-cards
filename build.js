/**
 * Static Site Generator for Digital Cards
 * Fetches data from edge function (no secrets needed)
 */

const fs = require('fs');
const path = require('path');

const EDGE_FUNCTION_URL = process.env.EDGE_FUNCTION_URL;
const APP_URL = process.env.APP_URL || 'https://app.supremetech.contact';

if (!EDGE_FUNCTION_URL) {
  console.error('Error: EDGE_FUNCTION_URL environment variable is required');
  process.exit(1);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function applyTemplate(template, variables) {
  if (!template) return '';
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result.trim();
}

function getBorderRadius(radius) {
  if (!radius || radius === 'md') return '8px';
  if (radius === 'none') return '0';
  if (radius === 'sm') return '4px';
  if (radius === 'lg') return '12px';
  if (radius === 'xl') return '16px';
  if (radius === 'full') return '9999px';
  return '8px';
}

function parseFontSize(size) {
  if (!size) return '16px';
  if (size.endsWith('px')) return size;
  const sizes = { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '32px' };
  return sizes[size] || (parseInt(size) || 16) + 'px';
}

function getIconSize(size) {
  const sizes = { sm: 16, md: 20, lg: 24, xl: 32 };
  return sizes[size] || 20;
}

const ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#fff"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
};

function getIcon(iconName, size = 20) {
  const svg = ICONS[iconName] || ICONS.link;
  return svg.replace('<svg', `<svg width="${size}" height="${size}" style="flex-shrink:0;"`);
}

function getActionHref(element, profile, business, socialProfile) {
  const source = element.actionSource || '';
  const actionType = element.actionType;
  let value = null;
  
  switch (source) {
    case 'profile_phone': case 'personal_phone': case 'business_phone':
      value = business?.phone || profile?.phone; break;
    case 'profile_email': case 'personal_email': case 'user_login_email': case 'business_email':
      value = profile?.work_email || profile?.email; break;
    case 'company_email': value = business?.email; break;
    case 'company_website': case 'business_website': value = business?.website; break;
    case 'social_linkedin': value = socialProfile?.linkedin_url; break;
    case 'social_twitter': value = socialProfile?.twitter_url; break;
    case 'social_facebook': value = socialProfile?.facebook_url; break;
    case 'social_instagram': value = socialProfile?.instagram_url; break;
    case 'social_youtube': value = socialProfile?.youtube_url; break;
    case 'social_github': value = socialProfile?.github_url; break;
    case 'custom': value = element.customValue; break;
    default:
      if (actionType === 'call' || actionType === 'sms') value = business?.phone || profile?.phone;
      else if (actionType === 'email') value = profile?.email;
      else if (actionType === 'website') value = business?.website;
      else value = element.customValue;
  }
  
  if (!value) return '#';
  
  switch (actionType) {
    case 'call': return `tel:${value}`;
    case 'sms': return `sms:${value}`;
    case 'email': return `mailto:${value}`;
    default: return value.startsWith('http') ? value : `https://${value}`;
  }
}

function renderElement(element, data) {
  const { profile, business, socialProfile, colorScheme, avatarUrl, fullName, initials, title, bio, companyName } = data;
  const baseStyle = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width}px;height:${element.height}px;z-index:${element.zIndex || 0};`;
  
  switch (element.type) {
    case 'avatar': {
      const radius = getBorderRadius(element.borderRadius || 'full');
      const borderStyle = element.borderWidth > 0 ? `border:${element.borderWidth}px solid ${element.borderColor || 'transparent'};` : '';
      if (avatarUrl) {
        return `<div style="${baseStyle}${borderStyle}border-radius:${radius};overflow:hidden;background:${colorScheme.primary};"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" style="width:100%;height:100%;object-fit:cover;"></div>`;
      }
      return `<div style="${baseStyle}${borderStyle}border-radius:${radius};overflow:hidden;background:${colorScheme.primary};display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:${(element.height || 80) * 0.35}px;font-weight:bold;">${escapeHtml(initials)}</span></div>`;
    }
    case 'name': {
      const align = element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start';
      return `<div style="${baseStyle}color:${element.textColor || colorScheme.text};font-weight:${element.fontWeight || 'bold'};display:flex;align-items:center;justify-content:${align};overflow:hidden;"><span style="font-size:${parseFontSize(element.fontSize) || '20px'};white-space:nowrap;">${escapeHtml(fullName)}</span></div>`;
    }
    case 'title': {
      const align = element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start';
      return `<div style="${baseStyle}color:${element.textColor || colorScheme.text};font-weight:${element.fontWeight || 'normal'};opacity:0.85;display:flex;align-items:center;justify-content:${align};overflow:hidden;"><span style="font-size:${parseFontSize(element.fontSize) || '14px'};white-space:nowrap;">${escapeHtml(title || '')}</span></div>`;
    }
    case 'company': {
      const align = element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start';
      return `<div style="${baseStyle}color:${element.textColor || colorScheme.text};font-weight:500;opacity:0.75;display:flex;align-items:center;justify-content:${align};overflow:hidden;"><span style="font-size:${parseFontSize(element.fontSize) || '14px'};white-space:nowrap;">${escapeHtml(companyName)}</span></div>`;
    }
    case 'bio':
      return `<div style="${baseStyle}color:${element.textColor || colorScheme.text};font-size:${parseFontSize(element.fontSize) || '13px'};opacity:0.8;padding:8px;line-height:1.4;overflow:hidden;white-space:pre-wrap;text-align:${element.textAlign || 'center'};">${escapeHtml(bio || '')}</div>`;
    case 'image': {
      const isCompanyLogo = element.id?.includes('company_logo') || element.id?.includes('company_full_logo');
      const imageUrl = isCompanyLogo ? (business?.logo_full_url || business?.logo_icon_url || business?.logo_url || element.imageUrl) : element.imageUrl;
      const imgOpacity = element.opacity !== undefined ? element.opacity / 100 : 1;
      const radius = getBorderRadius(element.borderRadius);
      if (!imageUrl) return '';
      return `<div style="${baseStyle}border-radius:${radius};overflow:hidden;display:flex;align-items:center;justify-content:center;opacity:${imgOpacity};"><img src="${escapeHtml(imageUrl)}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:${radius};"></div>`;
    }
    case 'color_block': {
      const blockOpacity = element.opacity !== undefined ? element.opacity / 100 : 1;
      return `<div style="${baseStyle}background:${element.bgColor || colorScheme.secondary};border-radius:${getBorderRadius(element.borderRadius)};opacity:${blockOpacity};"></div>`;
    }
    case 'action_button': {
      const bgColor = element.bgColor || colorScheme.secondary;
      const textColor = element.textColor || '#ffffff';
      const iconSize = getIconSize(element.iconSize);
      const radius = getBorderRadius(element.borderRadius);
      const href = getActionHref(element, profile, business, socialProfile);
      const iconHtml = element.icon ? getIcon(element.icon, iconSize) : '';
      const isExternal = href.startsWith('http');
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(href)}"${target} style="${baseStyle}background:${bgColor};color:${textColor};border-radius:${radius};display:flex;align-items:center;justify-content:center;gap:${element.iconOnly ? 0 : 8}px;text-decoration:none;font-size:${parseFontSize(element.fontSize) || '14px'};font-weight:500;">${iconHtml}${!element.iconOnly && element.label ? `<span>${escapeHtml(element.label)}</span>` : ''}</a>`;
    }
    case 'button_primary': case 'button_secondary': {
      const isPrimary = element.type === 'button_primary';
      const bgColor = element.bgColor || (isPrimary ? colorScheme.primary : colorScheme.secondary);
      const textColor = element.textColor || '#ffffff';
      const radius = getBorderRadius(element.borderRadius);
      const href = getActionHref(element, profile, business, socialProfile);
      const iconSize = getIconSize(element.iconSize);
      const iconHtml = element.icon ? getIcon(element.icon, iconSize) : '';
      const isExternal = href.startsWith('http');
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(href)}"${target} style="${baseStyle}background:${bgColor};color:${textColor};border-radius:${radius};display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:${parseFontSize(element.fontSize) || '14px'};font-weight:500;">${iconHtml}${element.label ? `<span>${escapeHtml(element.label)}</span>` : ''}</a>`;
    }
    case 'social_icon': {
      const iconSize = getIconSize(element.iconSize);
      const iconColor = element.iconColor || colorScheme.primary;
      const bgColor = element.bgColor || 'transparent';
      const radius = getBorderRadius(element.borderRadius || 'full');
      const href = getActionHref(element, profile, business, socialProfile);
      const platform = element.platform || 'link';
      const iconHtml = getIcon(platform, iconSize);
      const isExternal = href.startsWith('http');
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(href)}"${target} style="${baseStyle}background:${bgColor};color:${iconColor};border-radius:${radius};display:flex;align-items:center;justify-content:center;text-decoration:none;">${iconHtml}</a>`;
    }
    case 'divider': {
      const dividerColor = element.color || colorScheme.text;
      const opacity = element.opacity !== undefined ? element.opacity / 100 : 0.2;
      return `<div style="${baseStyle}background:${dividerColor};opacity:${opacity};"></div>`;
    }
    case 'text':
      return `<div style="${baseStyle}color:${element.textColor || colorScheme.text};font-size:${parseFontSize(element.fontSize)};text-align:${element.textAlign || 'left'};overflow:hidden;">${escapeHtml(element.customValue || '')}</div>`;
    default: return '';
  }
}

function generateCardHTML(cardData) {
  const { card, profile, business, template, socialProfile } = cardData;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Contact';
  const jobTitle = profile?.job_title || '';
  const companyName = business?.name || '';
  
  const ogTitle = applyTemplate(card.og_title || '{{full_name}} - Digital Card', { full_name: fullName, job_title: jobTitle, company_name: companyName });
  const ogDescription = applyTemplate(card.og_description || '{{job_title}} at {{company_name}}', { full_name: fullName, job_title: jobTitle, company_name: companyName });
  const ogImage = card.og_image_url || profile?.avatar_url || business?.logo_url || `${APP_URL}/og-free-card.png`;
  const slug = card.public_slug || card.public_token;
  const canonicalUrl = `https://cards.supremetech.contact/${slug}`;
  
  const colorScheme = template?.color_scheme || { primary: "#3B82F6", secondary: "#1E40AF", background: "#FFFFFF", text: "#1F2937" };
  const themeColor = colorScheme.primary || business?.primary_color || '#000000';
  
  let backgroundStyle = `background:${colorScheme.background};`;
  if (template?.background_type === 'image' && template?.background_value) {
    backgroundStyle = `background-image:url(${template.background_value});background-size:cover;background-position:center;`;
  } else if (template?.background_type === 'gradient') {
    backgroundStyle = `background:linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary});`;
  } else if (template?.background_value) {
    backgroundStyle = `background:${template.background_value};`;
  }
  
  const layoutConfig = template?.layout_config || {};
  const elements = layoutConfig.elements || [];
  
  const customFields = card?.custom_fields || {};
  const avatarUrl = customFields?.profile_photo_url || profile?.avatar_url;
  const initials = `${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const title = card?.custom_title || profile?.job_title || '';
  const bio = card?.custom_bio || '';
  
  const renderData = { card, profile, business, socialProfile, colorScheme, avatarUrl, fullName, initials, title, bio, companyName };
  
  const elementsHtml = elements.filter(el => el.isVisible !== false).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(el => renderElement(el, renderData)).join('\n');
  
  const CANVAS_WIDTH = 390;
  const CANVAS_HEIGHT = 720;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="title" content="${escapeHtml(ogTitle)}">
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${escapeHtml(companyName || 'Digital Card')}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="theme-color" content="${themeColor}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/png" href="${business?.logo_icon_url || `${APP_URL}/pwa-192x192.png`}">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:0;background:#f0f0f0;}
    .card-container{width:100%;max-width:${CANVAS_WIDTH}px;min-height:100vh;${backgroundStyle}position:relative;overflow:hidden;}
    .card-canvas{position:relative;width:100%;height:${CANVAS_HEIGHT}px;}
    a{transition:opacity 0.2s;}a:hover{opacity:0.85;}a:active{opacity:0.7;}
    @media(min-width:${CANVAS_WIDTH + 40}px){body{align-items:center;padding:20px;}.card-container{min-height:auto;height:${CANVAS_HEIGHT}px;border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);}}
  </style>
</head>
<body>
  <div class="card-container">
    <div class="card-canvas">
${elementsHtml}
    </div>
  </div>
</body>
</html>`;
}

async function build() {
  console.log('🚀 Starting static card generation...');
  
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  
  console.log(`📡 Fetching cards from: ${EDGE_FUNCTION_URL}`);
  
  const response = await fetch(EDGE_FUNCTION_URL);
  if (!response.ok) throw new Error(`Edge function returned ${response.status}: ${await response.text()}`);
  
  const { cards, error } = await response.json();
  if (error) throw new Error(`Edge function error: ${error}`);
  
  console.log(`📇 Found ${cards?.length || 0} active cards`);
  
  let generated = 0, errors = 0;
  
  for (const cardData of (cards || [])) {
    try {
      const slug = cardData.card?.public_slug;
      if (!slug) continue;
      
      const html = generateCardHTML(cardData);
      fs.writeFileSync(path.join(distDir, `${slug}.html`), html);
      console.log(`✅ Generated: ${slug}.html`);
      generated++;
    } catch (err) {
      console.error(`❌ Error:`, err.message);
      errors++;
    }
  }
  
  // Index page
  fs.writeFileSync(path.join(distDir, 'index.html'), `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Digital Cards</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;}.container{text-align:center;padding:2rem;}h1{color:#333;}p{color:#666;}</style></head><body><div class="container"><h1>Digital Cards</h1><p>Visit a specific card URL to view it.</p></div></body></html>`);
  
  // 404 page
  fs.writeFileSync(path.join(distDir, '404.html'), `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Card Not Found</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5;}.container{text-align:center;padding:2rem;}h1{color:#333;}p{color:#666;}</style></head><body><div class="container"><h1>Card Not Found</h1><p>This digital card doesn't exist or has been deactivated.</p></div></body></html>`);
  
  console.log(`\n📊 Summary: ${generated} generated, ${errors} errors`);
  console.log('✨ Build complete!');
}

build().catch(err => { console.error('Build failed:', err); process.exit(1); });
