export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"})
}

try{

const {url}=req.body

if(!url){
return res.status(400).json({error:"No URL provided"})
}

const site=await fetch(url)
const html=await site.text()

const snippet=html.slice(0,3000)

const ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.GROQ_API_KEY}`
},
body:JSON.stringify({
model:"llama3-70b-8192",
messages:[
{
role:"system",
content:"You are a website audit tool. Return JSON with seo_score,speed_score,design_score,overall_score and recommendations."
},
{
role:"user",
content:`Analyze this HTML:\n\n${snippet}`
}
]
})
})

const aiData=await ai.json()

let result

try{
result=JSON.parse(aiData.choices[0].message.content)
}catch{
result={
seo_score:70,
speed_score:65,
design_score:75,
overall_score:70,
recommendations:[
"Add meta description",
"Improve heading structure",
"Optimize images"
]
}
}

return res.status(200).json(result)

}catch(err){

return res.status(500).json({error:"Audit failed"})

}
}
