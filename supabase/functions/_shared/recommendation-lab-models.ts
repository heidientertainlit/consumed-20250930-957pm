import type { LabProfile } from "../../../shared/recommendation-lab.ts";
export type LabStore = (action:string,payload?:Record<string,any>)=>Promise<any>;
const dimensions=["subject","themes","tone","experience","style","appeal"] as const;
export function validateProfile(raw:any,text:string):LabProfile{
  const profile:LabProfile={};
  for(const key of dimensions){
    profile[key]=(Array.isArray(raw?.[key])?raw[key]:[]).slice(0,4).filter((v:any)=>
      typeof v?.label==="string"&&v.label.trim().length>0&&v.label.length<=160
      &&typeof v.evidence==="string"&&v.evidence.length>=12&&v.evidence.length<=350
      &&text.toLowerCase().includes(v.evidence.toLowerCase()))
      .map((v:any)=>({label:v.label.trim(),evidence:v.evidence}));
  }
  return profile;
}
export function embeddingInputs(p:LabProfile){
  const labels=(keys:(keyof LabProfile)[])=>keys.flatMap(k=>(p[k]||[]).map(x=>x.label)).join(". ").slice(0,1800);
  return {appeal_embedding:labels(["appeal","experience"]),tone_style_embedding:labels(["tone","style"]),subject_theme_embedding:labels(["subject","themes"])};
}
export function createLabModels(store:LabStore,key:string|undefined,fetcher:typeof fetch=fetch){
  async function request(kind:string,route:string,body:any,reservation:number){
    if(!key)throw new Error("OpenAI credential unavailable; no charge attempted");
    const token=crypto.randomUUID();
    await store("reserve",{kind,token,amount:reservation});
    // Unknown transport outcomes retain their reservation: do not silently
    // refund potentially billed work or automatically retry.
    const r=await fetcher(`https://api.openai.com/v1/${route}`,{
      method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
      body:JSON.stringify(body),signal:AbortSignal.timeout(50_000),
    });
    if(!r.ok){
      if(r.status<500)await store("settle",{token,actual:0,usage:{http_status:r.status}});
      throw new Error(`Model request failed (${r.status})${r.status>=500?"; reservation retained":""}`);
    }
    const data=await r.json();const usage=data.usage;
    if(!usage)throw new Error("Model usage missing; reservation retained");
    const actual=kind==="embedding"?(usage.total_tokens*0.02/1e6):
      ((usage.prompt_tokens*0.15+usage.completion_tokens*0.60)/1e6);
    await store("settle",{token,actual,usage:{...usage,model:data.model||body.model,kind,provider:"openai"}});
    return data;
  }
  async function profile(work:any){
    const m=work.source_metadata;
    // Basic catalog fields are not evidence of sound, tone, pacing or themes.
    const evidence=String(m.description||"").slice(0,6000);
    if(evidence.length<100)return {...work,profile:{},profile_evidence:{missing:"Insufficient descriptive source evidence"},status:"verified"};
    const prompt=`Return JSON only. Extract a structured work profile ONLY from SOURCE, never from your memory or the title. Keys: subject, themes, tone, experience, style, appeal. Each is an array (max 3) of {label,evidence}. Use concise reusable characteristics, distinguishing subject from why the experience might appeal. evidence MUST be an exact quote (12-250 characters) from SOURCE supporting the label. Unknown dimensions must be []. Do not recommend works, invent titles, add facts, or infer music sound/lyrics from an album name. SOURCE:\n${evidence}`;
    const d=await request("profile","chat/completions",{model:"gpt-4o-mini",temperature:0,
      response_format:{type:"json_object"},max_tokens:750,messages:[{role:"user",content:prompt}]},0.01);
    let raw:any;try{raw=JSON.parse(d.choices?.[0]?.message?.content||"{}");}catch{throw new Error("Invalid profile JSON; charged usage retained");}
    const p=validateProfile(raw,evidence),inputs=embeddingInputs(p),keys=Object.keys(inputs).filter(k=>inputs[k as keyof typeof inputs]);
    if(!keys.length)return {...work,profile:p,profile_evidence:{source_description:evidence,profile_model:d.model,missing:"No supported dimensions"},status:"profiled"};
    const strings=keys.map(k=>inputs[k as keyof typeof inputs]);
    const e=await request("embedding","embeddings",{model:"text-embedding-3-small",dimensions:256,input:strings},0.002);
    if(!Array.isArray(e.data)||e.data.length!==keys.length)throw new Error("Embedding response count mismatch");
    const vectors:Record<string,number[]>={};
    for(let i=0;i<keys.length;i++){
      const v=e.data.find((x:any)=>x.index===i)?.embedding;
      if(!Array.isArray(v)||v.length!==256||v.some((x:any)=>typeof x!=="number"||!Number.isFinite(x)))throw new Error("Invalid embedding vector");
      vectors[keys[i]]=v;
    }
    const bytes=new TextEncoder().encode(JSON.stringify(inputs));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");
    return {...work,profile:p,profile_evidence:{source_description:evidence,profile_model:d.model,extraction_version:"quoted-1"},
      ...vectors,embedding_model:"text-embedding-3-small",embedding_dimensions:256,embedding_input_hash:hash,status:"embedded"};
  }
  async function current(title:string,type:string,context:any){
    // Exact existing generation prompt and model settings. Replay is isolated
    // solely to retain usage and avoid shared search's canonical-write effects.
    const query=`Find me media similar to "${title}" (${type}). Include: other ${type==='tv'?'TV shows':type==='movie'?'movies':type?.toLowerCase()+'s'} like it, soundtrack music, books it's based on or similar books, related podcasts, and any connected media. Mix of types please.`;
    const dna=context.dna;
    const dnaContext=dna?`User's Entertainment DNA: ${dna.profile_text}\nFavorite types: ${dna.favorite_media_types?.join(', ')||'various'}\nFavorite genres: ${dna.favorite_genres?.join(', ')||'various'}`:"No Entertainment DNA profile available";
    const recent=(context.recent||[]).map((x:any)=>`${x.title} by ${x.creator||'Unknown'} (${x.media_type})`).join(", ")||"no recent media tracked";
    const prompt=`You are an expert entertainment recommendation engine. A user is asking: "${query}"

Context about this user:
${dnaContext}

Recent media they've tracked: ${recent}

Based on their query and profile, provide 3-5 personalized recommendations. For each recommendation, provide:
- title: exact title of the media
- type: one of "movie", "tv", "book", "music", "podcast", "game", "youtube"  
- description: 2-3 sentences explaining why this matches their request
- searchTerm: a good search term they could use to find more like this

Also provide an explanation of why these recommendations match their query and 3-4 related search suggestions.

Respond in JSON format with:
- explanation: why these recommendations match their query
- recommendations: array of recommendation objects
- searchSuggestions: array of related search terms they might try

Focus on content that directly answers their question and matches their demonstrated preferences.`;
    if(new TextEncoder().encode(prompt).length>45000)throw new Error("Baseline context exceeds bounded input limit");
    const d=await request("current","chat/completions",{model:"gpt-4o-mini",temperature:0.7,
      response_format:{type:"json_object"},max_tokens:1500,messages:[
        {role:"system",content:"You are an expert entertainment recommendation engine. Always respond with valid JSON in the exact format requested."},
        {role:"user",content:prompt},
      ]},0.01);
    const parsed=JSON.parse(d.choices?.[0]?.message?.content||"{}");
    if(!Array.isArray(parsed.recommendations))throw new Error("Invalid CURRENT response");
    return {recommendations:parsed.recommendations.slice(0,6),explanation:parsed.explanation,query};
  }
  return {profile,current};
}
