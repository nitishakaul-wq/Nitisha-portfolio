export default async function handler(req, res) {

if (req.method !== "POST") {
return res.status(200).json({ message: "API running" });
}

try {

let { url } = req.body;

if (!url) {
return res.status(400).json({ error: "URL required" });
}

// normalize URL
url = url.trim();

if (!url.startsWith("http")) {
url = "https://" + url;
}

// fetch website
const response = await fetch(url, {
headers: {
"User-Agent": "Mozilla/5.0"
},
redirect: "follow"
});

const html = await response.text();

// simple checks
const title = html.match(/<title>(.*?)</title>/i);
const meta = html.includes('name="description"');
const h1 = (html.match(/<h1/gi) || []).length;

let score = 0;

if (title) score += 40;
if (meta) score += 30;
if (h1 === 1) score += 30;

const recommendations = [];

if (!title) recommendations.push("Add a title tag");
if (!meta) recommendations.push("Add a meta description");
if (h1 !== 1) recommendations.push("Use exactly one H1 tag");

return res.status(200).json({
seo_score: score,
title: title ? title[1] : "Missing",
h1_count: h1,
recommendations
});

} catch (error) {

console.error(error);

return res.status(200).json({
seo_score: 50,
recommendations: [
"Website blocked automated request",
"Try another website"
]
});

}

}
