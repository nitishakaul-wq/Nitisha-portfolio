/**
 * Vercel serverless API: SEO audit (real checks, 100-point score).
 * POST /api/audit with body { "url": "https://example.com" }
 * Score: Structure 30, Technical SEO 30, Content Quality 40.
 */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(200).json({ message: "API running" });
  }

  const emptyResult = (overrides = {}) =>
    res.status(200).json({
      seo_score: 0,
      breakdown: { structure: 0, technical_seo: 0, content_quality: 0 },
      details: {},
      recommendations: [],
      technical_checks_skipped: false,
      ...overrides,
    });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch {
        return res.status(400).json({
          error: "Invalid JSON",
          seo_score: 0,
          breakdown: { structure: 0, technical_seo: 0, content_quality: 0 },
          details: {},
          recommendations: ["Send a valid JSON body with a 'url' field."],
        });
      }
    }
    body = body || {};

    let { url } = body;
    if (url == null || String(url).trim() === "") {
      return res.status(400).json({
        error: "URL required",
        seo_score: 0,
        breakdown: { structure: 0, technical_seo: 0, content_quality: 0 },
        details: {},
        recommendations: ["Please enter a website URL."],
      });
    }

    url = String(url).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const signal = controller.signal;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEOAudit/2.0; +https://example.com)",
      },
      redirect: "follow",
      signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return emptyResult({
        seo_score: 50,
        recommendations: [
          `Server returned ${response.status}. Try another website.`,
        ],
      });
    }

    const finalUrl = response.url || url;
    const origin = getOrigin(finalUrl);
    const html = await response.text();
    const pageSize = typeof html.length === "number" ? html.length : 0;

    const details = analyzePage(html, finalUrl, origin);
    details.page_size_bytes = pageSize;

    const {
      has_robots_txt,
      has_sitemap,
      technical_checks_skipped,
    } = await checkTechnicalUrls(origin);
    details.has_robots_txt = has_robots_txt;
    details.has_sitemap = has_sitemap;
    details.is_https = finalUrl.startsWith("https://");

    const { score: structureScore, recommendations: structureRecs } =
      scoreStructure(details);
    const { score: technicalScore, recommendations: technicalRecs } =
      scoreTechnical(details);
    const { score: contentScore, recommendations: contentRecs } =
      scoreContent(details);
    const articleRecs = recommendArticle(details);

    const seo_score = Math.round(
      structureScore + technicalScore + contentScore
    );
    const recommendations = [
      ...structureRecs,
      ...technicalRecs,
      ...contentRecs,
      ...articleRecs,
    ].slice(0, 18);

    return res.status(200).json({
      seo_score: Math.min(100, Math.max(0, seo_score)),
      breakdown: {
        structure: Math.round(structureScore),
        technical_seo: Math.round(technicalScore),
        content_quality: Math.round(contentScore),
      },
      details: sanitizeDetails(details),
      recommendations,
      technical_checks_skipped: technical_checks_skipped || false,
    });
  } catch (error) {
    console.error("Audit error:", error);
    const message =
      error.name === "AbortError"
        ? "Request timed out. Try another website."
        : "Website could not be fetched. Try another URL.";
    return emptyResult({
      seo_score: 50,
      recommendations: [message],
    });
  }
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function analyzeOpenGraph(html) {
  const ogTitle = /<meta\s[^>]*property\s*=\s*["']og:title["'][^>]*>/i.test(html) ||
    /<meta\s[^>]*content\s*=[^>]*property\s*=\s*["']og:title["']/i.test(html);
  const ogDesc = /<meta\s[^>]*property\s*=\s*["']og:description["'][^>]*>/i.test(html) ||
    /<meta\s[^>]*content\s*=[^>]*property\s*=\s*["']og:description["']/i.test(html);
  const ogImage = /<meta\s[^>]*property\s*=\s*["']og:image["'][^>]*>/i.test(html) ||
    /<meta\s[^>]*content\s*=[^>]*property\s*=\s*["']og:image["']/i.test(html);
  return {
    has_og_title: ogTitle,
    has_og_description: ogDesc,
    has_og_image: ogImage,
  };
}

function analyzeTwitterCards(html) {
  const twCard = /<meta\s[^>]*name\s*=\s*["']twitter:card["'][^>]*>/i.test(html) ||
    /<meta\s[^>]*content\s*=[^>]*name\s*=\s*["']twitter:card["']/i.test(html);
  const twTitle = /<meta\s[^>]*name\s*=\s*["']twitter:title["'][^>]*>/i.test(html) ||
    /<meta\s[^>]*content\s*=[^>]*name\s*=\s*["']twitter:title["']/i.test(html);
  const twDesc = /<meta\s[^>]*name\s*=\s*["']twitter:description["'][^>]*>/i.test(html) ||
    /<meta\s[^>]*content\s*=[^>]*name\s*=\s*["']twitter:description["']/i.test(html);
  return {
    has_twitter_card: twCard,
    has_twitter_title: twTitle,
    has_twitter_description: twDesc,
  };
}

const STRUCTURED_DATA_TYPES = ["LocalBusiness", "Product", "FAQPage", "Review", "BreadcrumbList"];

function analyzeStructuredData(html) {
  const ldJsonBlocks = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const typesFound = [];
  for (const block of ldJsonBlocks) {
    const contentMatch = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const content = contentMatch ? contentMatch[1].trim() : "";
    if (!content) continue;
    for (const type of STRUCTURED_DATA_TYPES) {
      const re = new RegExp('"@type"\\s*:\\s*["\']' + type + '["\']', "i");
      if (re.test(content)) typesFound.push(type);
    }
    const arrayTypeRe = /"@type"\s*:\s*\[\s*["']([^"']+)["']/gi;
    let m;
    while ((m = arrayTypeRe.exec(content)) !== null) {
      const t = m[1];
      if (STRUCTURED_DATA_TYPES.some((st) => st.toLowerCase() === t.toLowerCase()) && !typesFound.includes(t)) {
        typesFound.push(STRUCTURED_DATA_TYPES.find((st) => st.toLowerCase() === t.toLowerCase()));
      }
    }
  }
  const unique = [...new Set(typesFound)];
  return {
    has_structured_data: unique.length > 0,
    structured_data_types: unique,
  };
}

function analyzePerformanceSignals(html, pageSizeBytes) {
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const linkStyles = (html.match(/<link\s[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi) || []).length;
  const styleTags = (html.match(/<style\b/gi) || []).length;
  const cssCount = linkStyles + styleTags;
  return {
    script_count: scriptCount,
    css_count: cssCount,
    html_size_kb: Math.round((pageSizeBytes / 1024) * 10) / 10,
  };
}

function analyzePage(html, pageUrl, origin) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
  const titleLength = titleRaw ? titleRaw.length : 0;

  const metaDescMatch = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i
  ) || html.match(
    /<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i
  );
  const metaDescRaw = metaDescMatch ? metaDescMatch[1].trim() : null;
  const metaDescLength = metaDescRaw ? metaDescRaw.length : 0;

  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;

  const hasCanonical = /<link\s[^>]*rel\s*=\s*["']canonical["'][^>]*>/i.test(html) ||
    /<link\s[^>]*href\s*=[^>]*rel\s*=\s*["']canonical["']/i.test(html);
  const hasViewport = /<meta\s[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(html);

  const imgTags = html.match(/<img\s[^>]*>/gi) || [];
  const imagesTotal = imgTags.length;
  const imagesWithAlt = imgTags.filter((tag) =>
    /\balt\s*=\s*["'][^"']*["']/i.test(tag) || /\balt\s*=\s*["'][^"']*$/i.test(tag)
  ).length;

  const aTags = html.match(/<a\s[^>]*href\s*=\s*["']([^"']*)["'][^>]*>/gi) || [];
  let internalLinks = 0;
  let externalLinks = 0;
  try {
    const base = new URL(pageUrl);
    for (const tag of aTags) {
      const hrefMatch = tag.match(/href\s*=\s*["']([^"']*)["']/i);
      const href = hrefMatch ? hrefMatch[1].trim() : "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      let absoluteHref;
      try {
        absoluteHref = new URL(href, base).href;
      } catch {
        continue;
      }
      if (origin && new URL(absoluteHref).origin === origin) internalLinks++;
      else externalLinks++;
    }
  } catch (_) {
    internalLinks = 0;
    externalLinks = aTags.length;
  }

  const articleSignals = analyzeArticleSignals(html);
  const likelySpa = detectLikelySpa(html, h1Count, h2Count, imagesTotal);
  const ogSignals = analyzeOpenGraph(html);
  const twitterSignals = analyzeTwitterCards(html);
  const structuredData = analyzeStructuredData(html);
  const pageSizeBytes = typeof html.length === "number" ? html.length : 0;
  const perfSignals = analyzePerformanceSignals(html, pageSizeBytes);

  return {
    title: titleRaw || null,
    title_length: titleLength,
    title_present: !!titleRaw,
    meta_description: metaDescRaw || null,
    meta_description_length: metaDescLength,
    meta_description_present: !!metaDescRaw,
    h1_count: h1Count,
    h2_count: h2Count,
    has_canonical: hasCanonical,
    has_viewport: hasViewport,
    images_total: imagesTotal,
    images_with_alt: imagesWithAlt,
    internal_links: internalLinks,
    external_links: externalLinks,
    ...articleSignals,
    likely_spa: likelySpa,
    ...ogSignals,
    ...twitterSignals,
    ...structuredData,
    ...perfSignals,
  };
}

function analyzeArticleSignals(html) {
  const ogTypeMatch = html.match(
    /<meta\s[^>]*property\s*=\s*["']og:type["'][^>]*content\s*=\s*["']([^"']*)["']/i
  ) || html.match(
    /<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:type["']/i
  );
  const ogType = ogTypeMatch ? ogTypeMatch[1].trim().toLowerCase() : null;
  const isArticleType = ogType === "article" || ogType === "newsarticle";

  const hasArticleTag = /<article\b/i.test(html);
  const hasSchemaArticle =
    /"@type"\s*:\s*["']Article["']/i.test(html) ||
    /"@type"\s*:\s*["']NewsArticle["']/i.test(html);

  const authorMatch = html.match(
    /<meta\s[^>]*name\s*=\s*["']author["'][^>]*content\s*=\s*["']([^"']*)["']/i
  ) || html.match(
    /<meta\s[^>]*property\s*=\s*["']article:author["'][^>]*content\s*=\s*["']([^"']*)["']/i
  );
  const hasAuthor = !!(authorMatch && authorMatch[1].trim());

  const publishedMatch = html.match(
    /<meta\s[^>]*property\s*=\s*["']article:published_time["'][^>]*content\s*=\s*["']([^"']*)["']/i
  ) || html.match(
    /<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']article:published_time["']/i
  );
  const hasPublishedTime = !!(publishedMatch && publishedMatch[1].trim());

  return {
    og_type: ogType || null,
    is_article_type: isArticleType,
    has_article_tag: hasArticleTag,
    has_schema_article: hasSchemaArticle,
    has_author_meta: hasAuthor,
    has_published_time: hasPublishedTime,
  };
}

function detectLikelySpa(html, h1Count, h2Count, imagesTotal) {
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const semanticContent = h1Count + h2Count + imagesTotal;
  const hasRootApp = /id\s*=\s*["']root["']|id\s*=\s*["']app["']|id\s*=\s*["']__next["']|id\s*=\s*["']app-root["']/i.test(html);
  return (
    scriptCount >= 4 &&
    semanticContent < 4 &&
    (html.length > 3000 || hasRootApp)
  );
}

async function checkTechnicalUrls(origin) {
  const out = {
    has_robots_txt: false,
    has_sitemap: false,
    technical_checks_skipped: false,
  };
  if (!origin) return out;

  const controller = new AbortController();
  const timeoutMs = 3000;
  const timeoutId = setTimeout(() => {
    controller.abort();
    out.technical_checks_skipped = true;
  }, timeoutMs);
  const signal = controller.signal;
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; SEOAudit/2.0)" };

  const robotsPromise = fetch(origin + "/robots.txt", { signal, headers })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  const sitemapPromise = fetch(origin + "/sitemap.xml", { signal, headers })
    .then((r) => r.ok)
    .catch(() => false);

  try {
    const [robotsSettled, sitemapSettled] = await Promise.allSettled([
      robotsPromise,
      sitemapPromise,
    ]);
    clearTimeout(timeoutId);

    const robotsText =
      robotsSettled.status === "fulfilled" ? robotsSettled.value : "";
    const sitemapOk =
      sitemapSettled.status === "fulfilled" ? sitemapSettled.value : false;

    out.has_robots_txt = typeof robotsText === "string" && robotsText.length > 0;
    out.has_sitemap =
      sitemapOk ||
      (typeof robotsText === "string" &&
        /sitemap\s*:\s*https?:\/\//i.test(robotsText));
  } catch (_) {
    clearTimeout(timeoutId);
    out.technical_checks_skipped = true;
  }

  return out;
}

function scoreStructure(d) {
  let score = 0;
  const recs = [];
  if (d.title_present) {
    score += 5;
    if (d.title_length >= 30 && d.title_length <= 60) score += 5;
    else if (d.title_length > 0) score += 2;
    if (d.title_length > 60) recs.push("Shorten your title tag (ideal 30–60 characters).");
    if (d.title_length > 0 && d.title_length < 30) recs.push("Consider a longer title (30–60 characters is ideal).");
  } else recs.push("Add a title tag.");
  if (d.meta_description_present) {
    score += 5;
    if (d.meta_description_length >= 120 && d.meta_description_length <= 160) score += 5;
    else if (d.meta_description_length > 0) score += 2;
    if (d.meta_description_length > 160) recs.push("Shorten meta description (ideal 120–160 characters).");
    if (d.meta_description_length > 0 && d.meta_description_length < 120) recs.push("Consider a longer meta description (120–160 characters).");
  } else recs.push("Add a meta description.");
  if (d.h1_count === 1) score += 5;
  else if (d.h1_count > 1) {
    score += 2;
    recs.push(`Use exactly one H1 tag (found ${d.h1_count}).`);
  } else recs.push("Use exactly one H1 tag.");
  if (d.h2_count >= 1) score += 3;
  else if (d.h1_count >= 1) score += 1;
  return { score: Math.min(30, score), recommendations: recs };
}

function scoreContent(d) {
  let score = 0;
  const recs = [];
  if (d.images_total > 0) {
    const ratio = d.images_with_alt / d.images_total;
    score += Math.round(10 * ratio);
    if (ratio < 1) recs.push(`Your page has ${d.images_total} image(s) but only ${d.images_with_alt} have alt attributes.`);
  } else score += 10;
  const internal = d.internal_links || 0;
  if (internal >= 3) score += 8;
  else if (internal >= 1) score += 5;
  else recs.push("Add internal links to other pages on your site.");
  let contentSignals = 0;
  if (d.external_links > 0) contentSignals += 4;
  if (d.h2_count >= 2) contentSignals += 4;
  if (d.page_size_bytes > 500) contentSignals += 2;
  if (d.meta_description_present && d.title_present) contentSignals += 4;
  score += Math.min(14, contentSignals);
  if (d.has_og_title && d.has_og_description && d.has_og_image) score += 4;
  else if (d.has_og_title || d.has_og_description || d.has_og_image) score += 2;
  else recs.push("Add Open Graph tags (og:title, og:description, og:image) to improve social sharing previews.");
  if (d.has_twitter_card && d.has_twitter_title && d.has_twitter_description) score += 4;
  else if (d.has_twitter_card || d.has_twitter_title || d.has_twitter_description) score += 2;
  else recs.push("Add Twitter Card meta tags to improve Twitter link previews.");
  return { score: Math.min(40, score), recommendations: recs };
}

function scoreTechnical(d) {
  let score = 0;
  const recs = [];
  const pts = { robots: 4, sitemap: 4, https: 4, canonical: 4, viewport: 4 };
  if (d.has_robots_txt) score += pts.robots; else recs.push("Add a robots.txt file.");
  if (d.has_sitemap) score += pts.sitemap; else recs.push("Add a sitemap (e.g. sitemap.xml).");
  if (d.is_https) score += pts.https; else recs.push("Use HTTPS for this page.");
  if (d.has_canonical) score += pts.canonical; else recs.push("Add a canonical tag.");
  if (d.has_viewport) score += pts.viewport; else recs.push("Add a viewport meta tag for mobile.");
  if (d.has_structured_data) score += 5;
  else recs.push("Add structured data (Schema.org JSON-LD) to improve search engine rich results.");
  const htmlKb = d.html_size_kb != null ? d.html_size_kb : (d.page_size_bytes || 0) / 1024;
  const scriptCount = d.script_count != null ? d.script_count : 0;
  if (htmlKb <= 500 && scriptCount <= 20) score += 5;
  else recs.push("This page may be heavy. Consider reducing JavaScript and optimizing assets.");
  return { score: Math.min(30, score), recommendations: recs };
}

function recommendArticle(d) {
  const recs = [];
  if (!d.is_article_type && !d.has_schema_article && !d.has_article_tag) return recs;
  if (d.is_article_type || d.has_schema_article) {
    if (!d.has_author_meta) recs.push("Article pages: add author meta (name=\"author\" or article:author).");
    if (!d.has_published_time) recs.push("Article pages: add article:published_time for better rich results.");
  }
  if (d.has_article_tag && !d.has_schema_article && !d.is_article_type)
    recs.push("Consider adding Open Graph og:type=article or Schema.org Article for article pages.");
  return recs;
}

function sanitizeDetails(d) {
  return {
    title: d.title || "—",
    title_length: d.title_length,
    title_present: d.title_present,
    meta_description_length: d.meta_description_length,
    meta_description_present: d.meta_description_present,
    h1_count: d.h1_count,
    h2_count: d.h2_count,
    has_canonical: d.has_canonical,
    has_viewport: d.has_viewport,
    has_robots_txt: d.has_robots_txt,
    has_sitemap: d.has_sitemap,
    is_https: d.is_https,
    images_total: d.images_total,
    images_with_alt: d.images_with_alt,
    internal_links: d.internal_links,
    external_links: d.external_links,
    page_size_bytes: d.page_size_bytes,
    og_type: d.og_type || null,
    is_article_type: d.is_article_type || false,
    has_article_tag: d.has_article_tag || false,
    has_schema_article: d.has_schema_article || false,
    has_author_meta: d.has_author_meta || false,
    has_published_time: d.has_published_time || false,
    likely_spa: d.likely_spa || false,
    has_og_title: d.has_og_title || false,
    has_og_description: d.has_og_description || false,
    has_og_image: d.has_og_image || false,
    has_twitter_card: d.has_twitter_card || false,
    has_twitter_title: d.has_twitter_title || false,
    has_twitter_description: d.has_twitter_description || false,
    has_structured_data: d.has_structured_data || false,
    structured_data_types: Array.isArray(d.structured_data_types) ? d.structured_data_types : [],
    script_count: d.script_count != null ? d.script_count : 0,
    css_count: d.css_count != null ? d.css_count : 0,
    html_size_kb: d.html_size_kb != null ? d.html_size_kb : (d.page_size_bytes != null ? Math.round((d.page_size_bytes / 1024) * 10) / 10 : 0),
  };
}
