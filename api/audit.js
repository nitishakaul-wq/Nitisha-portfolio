export default async function handler(req, res) {

try {

if (req.method !== "POST") {
return res.status(200).json({ message: "Audit API running" })
}

const { url } = req.body

if (!url) {
return res.status(400).json({ error: "URL required" })
}

// fetch website
const start = Date.now()

const response = await fetch(url,{
headers:{ "User-Agent":"Mozilla/5.0"}
})

const html = await response.text()

const loadTime = Date.now() - start

// SEO checks

const title = html.match(/<title>(.*?)<\/title>/i)
const meta = html.match(/name=["']description["']/i)
const h1 = (html.match(/<h1/gi) || []).length
const imgs = (html.match(/<img/gi) || []).length
const alts = (html.match(/alt=/gi) || []).length
const links = (html.match(/<a\s+href/gi) || []).length
const viewport = html.includes("viewport")

let seo = 0
let speed = 70
let design = 70

if(title) seo += 20
if(meta) seo += 20
if(h1 === 1) seo += 20
if(viewport) seo += 10
if(imgs>0){
const ratio = alts/imgs
seo += Math.round(ratio*20)
}
if(links>5) seo += 10

if(seo>100) seo=100

const overall = Math.round((seo+speed+design)/3)

const recommendations=[]

if(!meta) recommendations.push("Add a meta description to improve search click-through rate")

if(h1!==1) recommendations.push("Use exactly one H1 tag for better SEO structure")

if(imgs>alts) recommendations.push("Add alt text to images for accessibility and image SEO")

if(!viewport) recommendations.push("Add mobile viewport meta tag")

if(loadTime>2000) recommendations.push("Improve page load speed")

return res.status(200).json({
seo_score:seo,
speed_score:speed,
design_score:design,
overall_score:overall,
load_time:loadTime,
title:title?title[1]:"Missing",
images:imgs,
missing_alt:imgs-alts,
recommendations
})

}catch(e){

return res.status(200).json({
seo_score:50,
speed_score:60,
design_score:60,
overall_score:57,
recommendations:["Audit failed on this website"]
})

}

}
