import { Index } from "@upstash/vector";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";


const app = new Hono();
app.use(cors())
app.post('/',async(c)=>{
  try{
    const index = new Index({
   
    cache: false,
    url: "https://accurate-anchovy-84525-eu1-vector.upstash.io",
    token: "ABoFMGFjY3VyYXRlLWFuY2hvdnktODQ1MjUtZXUxYWRtaW5aV0ZrT0dRek56TXRPV0kwTkMwMFlUUmpMVGhtTldFdFlXWXhNRFF4T1dSak5UZG0=",
  
  });
    if(c.req.header('Content-Type') !== "application/json"){
      return c.json({error:"It is not in JSON format"},{status:406})
    }
    const body = await c.req.json();
    const {message} = body as {message:string}
    if(message.length > 1000){
      return c.json({error:"Too Large to Handle"},{status:413})
    }
    const [words,semantc] = await Promise.all([wordssplitter(message),semantcsplitter(message)])
    const flaggedFor = new Set<{
      score:number,
      word:string
    }>()
     const vectorRes = await Promise.all([
      ...words.map(async (word)=>{
        const [query] = await index.query({
          topK:1,
          data:word,
          includeMetadata:true
        })
        if(query && query.score >0.95){
          flaggedFor.add({
            score:query.score,
            word:word
          })
        }
        return {score:0} 
      }),
      ...semantc.map(async(words)=>{
        const [query] = await index.query({
          topK:1,
          data:words,
          includeMetadata:true
        })
        if(query && query.score > 0.85){
          flaggedFor.add({
            score:query.score,
            word:words
          })
        }
        return query!
      })
    ])

    if(flaggedFor.size > 0 ){
      const profane = Array.from(flaggedFor).sort((a,b)=>a.score > b.score ? -1 : 1)[0]
      return c.json({
        isProfane:true,
        word:profane
      })
    }
    else{
      const profane = vectorRes.sort((a,b)=>a.score > b.score ? -1 : 1)[0]
      return c.json({
        isProfane:false,
        word:profane
      })
    }
  }
  catch(e){
    console.log(e)
  }
})

const semantic = new RecursiveCharacterTextSplitter({
  chunkOverlap:4,
  chunkSize:10
})

function wordssplitter(message:string)  {
 return message.split(/\s/)
}

async function semantcsplitter(message:string){
  const chunky = await semantic.createDocuments([message])
  const chunks = chunky.map((ch)=>ch.pageContent)
  return chunks
}
