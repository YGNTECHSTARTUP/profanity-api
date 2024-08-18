import { Index } from "@upstash/vector";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const sematic = new RecursiveCharacterTextSplitter({
  chunkOverlap:8,
  chunkSize:25,
  separators:[" "]
})
const THRESHOLD = 0.85
const app = new Hono()
app.use(cors())
app.post("/",async (c)=>{
try {
  const {VECTOR_TOKEN,VECTOR_URL} = env<{
    VECTOR_URL:string,
    VECTOR_TOKEN:string
  }>(c)
  const index = new Index({
   
    cache: false,
    url: "https://accurate-anchovy-84525-eu1-vector.upstash.io",
    token: "ABoFMGFjY3VyYXRlLWFuY2hvdnktODQ1MjUtZXUxYWRtaW5aV0ZrT0dRek56TXRPV0kwTkMwMFlUUmpMVGhtTldFdFlXWXhNRFF4T1dSak5UZG0=",
  
  });
  if(c.req.header("Content-Type") !== "application/json"){
    return c.json({error:"Content-Type must be application/json"},{status:406})
  }
  const body = await c.req.json()
  let {message} = body as {message:string}
  if(!message){
    return c.json({error:"message is required"},{status:406})
  }
  if(message.length > 1000){
    return c.json({error:"message must be less than 1000 characters"},{status:413})
  }
  const [wordChunk,sematicChunk] = await Promise.all([
    wordSplitter(message),
    sematicSplitter(message)
  ])

  const flaggedFor = new Set<{
    score:number,
    word:string
  }>()
  const vectorRes = await Promise.all([
    ...wordChunk.map(async (word)=>{
      const [vector] = await index.query({
        topK:1,
        data:word,
        includeMetadata:true
      })
      if(vector && vector.score > 0.95)
        {
          flaggedFor.add({
            score:vector.score,
            word:word
          })
        }
        return {score:0}
    }),
    ...sematicChunk.map(async (chunk)=>{
     const [vector] = await index.query({
        topK:1,
        data:chunk,
        includeMetadata:true
      })
      if(vector && vector.score > THRESHOLD)
        {
          flaggedFor.add({
            score:vector.score,
            word:chunk
          })
        }
        return vector!
     })
  ])

  if(flaggedFor.size > 0){
    const sorted = Array.from(flaggedFor).sort((a,b)=>a.score > b.score ? -1 : 1)[0]
    return c.json({
      isProfane:true,
      score:sorted.score,
      word:sorted.word!as string
    })
    
  }
  else{
    const mostProfaneCHunk = vectorRes.sort((a,b)=>a.score > b.score ? -1 : 1)[0]!
    return c.json({
        isProfane:false,
        score:mostProfaneCHunk.score,
      })
  }
 
} catch (error) {
return c.json({error:error},{status:500})
}
})

const wordSplitter = (message:string) => {
  const words = message.split(/\s/)
  return words
}

const sematicSplitter = async (message:string) => {
   const document = await sematic.createDocuments([message])
   const chunks = document.map((doc)=>doc.pageContent)
    return chunks
}
export default app
