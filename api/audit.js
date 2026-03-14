export default async function handler(req, res) {

try {

if (req.method !== "POST") {
return res.status(200).json({ message: "Audit API running" })
}

let { url } = req.body

if (!url) {
return res.status(400).json({ error: "URL required" })
}

// normalize url
url = url.trim()

if (!url.startsWith("http")) {
url = "https://" + url
}

// measure load time
const start = Date.now()

let html = ""

try {

const response = await fetch(url, {
headers: {
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
},
redirect: "follow"
})

html = await response.text()

} catch (err) {

// if site blocks fetch
return res.status(200).json({
seo_score: 40,
speed_score: 60,
design_score: 60,
overall_score: 53,
recommendations: [
"Website blocked automated audit request",
"Server may block bots or security rules",
"Try another website"
]
})
}

const loadTime = Date.now() - start

// HTML checks
const title = html.match(/<title>(.*?)</title>/i)
const meta = html.match(/name=["']description["']/i)

const h1 = (html.match(/<h1/gi) || []).length
const imgs = (html.match(/<img/gi) || []).length
const alts = (html.match(/alt=/gi) || []).length
const links = (html.match(/<a\s+href/gi) || []).length
const viewport = html.includes("viewport")

// robots check
let robots = false

try {
const r = await fetch(new URL("/robots.txt", url))
if (r.status === 200) robots = true
} catch {}

// sitemap check
let sitemap = false

try {
const s = await fetch(new URL("/sitemap.xml", url))
if (s.status === 200) sitemap = true
} catch {}

// scoring
let seo = 0
let speed = 70
let design = 70

if (title) seo += 20
if (meta) seo += 20

if (h1 === 1) seo += 20
else if (h1 > 1) seo += 10

if (viewport) seo += 10

if (imgs > 0) {
const ratio = alts / imgs
seo += Math.round(ratio * 20)
}

if (links > 5) seo += 10
if (robots) seo += 5
if (sitemap) seo += 5

if (seo > 100) seo = 100

const overall = Math.round((seo + speed + design) / 3)

// recommendations
const rec = []

if (!title) rec.push("Add a title tag between 50-60 characters")
if (!meta) rec.push("Add a meta description of 150-160 characters")
if (h1 !== 1) rec.push("Use exactly one H1 tag")
if (imgs > alts) rec.push("Add alt text to images")
if (!viewport) rec.push("Add mobile viewport meta tag")
if (!robots) rec.push("Create a robots.txt file")
if (!sitemap) rec.push("Add sitemap.xml")

if (loadTime > 2000) rec.push("Improve page load speed")

return res.status(200).json({
seo_score: seo,
speed_score: speed,
design_score: design,
overall_score: overall,
load_time: loadTime,
title: title ? title[1] : "Missing",
h1_count: h1,
images: imgs,
missing_alt: imgs - alts,
robots,
sitemap,
recommendations: rec
})

} catch (err) {

console.error(err)

return res.status(200).json({
seo_score: 50,
speed_score: 60,
design_score: 60,
overall_score: 57,
recommendations: [
"Audit encountered an unexpected error",
"Try another website"
]
})

}

}
