export default async function handler(req,res){

try{

if(req.method !== "POST"){
return res.status(200).json({message:"API running"})
}

const {url}=req.body

if(!url){
return res.status(400).json({error:"URL required"})
}

// measure load time
const start=Date.now()

const response=await fetch(url,{
headers:{
"User-Agent":"Mozilla/5.0"
}
})

const html=await response.text()

const loadTime=Date.now()-start

// -------- HTML CHECKS --------

const titleMatch=html.match(/<title>(.*?)</title>/i)
const metaDesc=html.match(/name=["']description["']/i)

const h1=(html.match(/<h1/gi)||[]).length
const images=(html.match(/<img/gi)||[]).length
const alt=(html.match(/alt=/gi)||[]).length

const links=(html.match(/<a\s+href/gi)||[]).length

const viewport=html.includes("viewport")

// -------- ROBOTS CHECK --------

let robots=false

try{
const r=await fetch(url+"/robots.txt")
if(r.status===200) robots=true
}catch{}

// -------- SITEMAP CHECK --------

let sitemap=false

try{
const s=await fetch(url+"/sitemap.xml")
if(s.status===200) sitemap=true
}catch{}

// -------- SCORE CALCULATION --------

let seo=0
let speed=70
let design=70

if(titleMatch) seo+=20
if(metaDesc) seo+=20

if(h1===1) seo+=20
else if(h1>1) seo+=10

if(viewport) seo+=10

if(images>0){
const ratio=alt/images
seo+=Math.round(ratio*20)
}

if(links>5) seo+=10

if(robots) seo+=5
if(sitemap) seo+=5

if(seo>100) seo=100

const overall=Math.round((seo+speed+design)/3)

// -------- RECOMMENDATIONS --------

const recommendations=[]

if(!titleMatch)
recommendations.push("Add a title tag between 50-60 characters")

if(!metaDesc)
recommendations.push("Add a meta description of 150-160 characters")

if(h1!==1)
recommendations.push("Use exactly one H1 tag for proper SEO structure")

if(images>alt)
recommendations.push("Add alt text to images for accessibility and SEO")

if(!viewport)
recommendations.push("Add mobile viewport meta tag")

if(!robots)
recommendations.push("Create a robots.txt file to guide search engines")

if(!sitemap)
recommendations.push("Add sitemap.xml to help search engines discover pages")

if(loadTime>2000)
recommendations.push("Improve page load speed")

return res.status(200).json({

seo_score:seo,
speed_score:speed,
design_score:design,
overall_score:overall,

load_time:loadTime,
title:titleMatch?titleMatch[1]:"Missing",
h1_count:h1,
images:images,
missing_alt:images-alt,

robots:robots,
sitemap:sitemap,

recommendations

})

}catch(e){

return res.status(200).json({

seo_score:50,
speed_score:60,
design_score:60,
overall_score:57,

recommendations:[
"Audit failed for this website",
"Try another website"
]

})

}

}
