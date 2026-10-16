import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateProfile, embeddingInputs, createLabModels } from "./recommendation-lab-models.ts";
import { matches, createLabProviders } from "./recommendation-lab-providers.ts";
import { rankLab, cosine, LAB_WEIGHTS } from "./recommendation-lab-ranking.ts";
import { createRecommendationLab } from "./recommendation-lab-engine.ts";
import { recommendationLabHandler } from "./recommendation-lab-handler.ts";
import { generateSimilarMedia } from "../../../client/src/lib/similar-media.ts";
import type { LabWork } from "../../../shared/recommendation-lab.ts";

const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
const vector=(axis=0)=>Array.from({length:256},(_,i)=>Number(i===axis));
const work=(id:string,extra:Partial<LabWork>={}):LabWork=>({
  id,external_source:"tmdb",external_id:id,media_type:"movie",title:`Work ${id}`,source_verified:true,
  destination_path:`/media/movie/tmdb/${id}`,source_metadata:{creator:`Creator ${id}`,subjects:["Drama"]},
  verification:{origins:["bounded stress-test seed"]},profile:{},status:"verified",...extra,
});
const profile={appeal:[{label:"emotional repair",evidence:"an intimate portrait of emotional repair"}]};

test("profiles retain only verbatim source-supported dimensions; empty means unknown",()=>{
  const p=validateProfile({...profile,themes:[{label:"crime",evidence:"a completely fabricated description"}],tone:"invented"},
    "This is an intimate portrait of emotional repair.");
  assert.equal(p.appeal?.length,1);assert.deepEqual(p.themes,[]);assert.deepEqual(p.tone,[]);
  const inputs=embeddingInputs(p);assert.equal(inputs.appeal_embedding,"emotional repair");
  assert.equal(inputs.tone_style_embedding,"");assert.equal(inputs.subject_theme_embedding,"");
});
test("provider identity requires exact title, type, creator and any supplied year",()=>{
  assert.equal(matches({title:"Animals",type:"movie",creator:"Ben Affleck",year:2026},{title:"Animals",type:"movie",creator:"Greg Zglinski",year:2017}),false);
  assert.equal(matches({title:"Animals",type:"music",creator:"Pink Floyd"},{title:"Animals (2018 Remix)",type:"music",creator:"Pink Floyd"}),true);
  assert.equal(matches({title:"Animals",type:"movie"},{title:"Animals",type:"music",creator:"Pink Floyd"}),false);
  assert.equal(matches({title:"Big Little Lies",type:"book",creator:"Liane Moriarty"},{title:"Big Little Lies",type:"book",creator:"Reader's Companions"}),false);
});
test("no description means no fabricated music profile and zero model calls",async()=>{
  let called=0;
  const models=createLabModels(async()=>{called++;},"test",async()=>{called++;throw Error("Unexpected call");});
  const result=await models.profile(work("1",{media_type:"music"}));
  assert.equal(called,0);assert.deepEqual(result.profile,{});
  assert.match(result.profile_evidence.missing,/Insufficient/);
});
test("profile and three dimension embeddings use usage-accounted calls and correct vector provenance",async()=>{
  const journal:any[]=[];
  const models=createLabModels(async(a,p)=>{journal.push({a,p});return {};},"test",async(url,init)=>{
    const b=JSON.parse(String(init?.body));
    if(String(url).endsWith("chat/completions"))return json({model:"gpt-4o-mini",usage:{prompt_tokens:100,completion_tokens:30},choices:[{message:{content:JSON.stringify({
      ...profile,tone:[{label:"reflective",evidence:"an intimate portrait of emotional repair"}],
      subject:[{label:"family",evidence:"an intimate portrait of emotional repair"}],
    })}}]});
    assert.equal(b.model,"text-embedding-3-small");assert.equal(b.dimensions,256);assert.equal(b.input.length,3);
    return json({usage:{total_tokens:10},data:b.input.map((_:any,index:number)=>({index,embedding:vector(index)}))});
  });
  const result=await models.profile(work("1",{source_metadata:{description:"This is an intimate portrait of emotional repair. ".repeat(4)}}));
  assert.equal(result.status,"embedded");assert.match(result.embedding_input_hash,/^[a-f0-9]{64}$/);
  assert.equal(result.embedding_dimensions,256);assert.equal(result.appeal_embedding.length,256);
  assert.deepEqual(journal.map(x=>x.a),["reserve","settle","reserve","settle"]);
  assert.equal(journal[1].p.actual,(100*.15+30*.6)/1e6);
  assert.equal(journal[3].p.actual,10*.02/1e6);
});
test("reserve failure prevents a model request; unknown transport retains its reservation",async()=>{
  let network=0;
  const blocked=createLabModels(async()=>{throw Error("Cap reached");},"test",async()=>{network++;return json({});});
  await assert.rejects(blocked.current("Title","book",{}),/Cap reached/);assert.equal(network,0);
  const actions:string[]=[];
  const unknown=createLabModels(async(a)=>{actions.push(a);return {};},"test",async()=>{throw Error("Transport lost");});
  await assert.rejects(unknown.current("Title","book",{}),/Transport lost/);assert.deepEqual(actions,["reserve"]);
});
test("known rejection releases reservation, but server errors and missing usage retain it",async()=>{
  for(const [response,expected] of [[json({},429),["reserve","settle"]],[json({},503),["reserve"]],[json({choices:[]}),["reserve"]]] as const){
    const actions:string[]=[];
    const models=createLabModels(async(a)=>{actions.push(a);return {};},"test",async()=>response);
    await assert.rejects(models.current("Title","book",{}));assert.deepEqual(actions,expected);
  }
});
test("CURRENT replay exactly matches the consumer query, server prompt, model, and settings",async()=>{
  const existing=await readFile("supabase/functions/conversational-search/index.ts","utf8");
  const template=existing.match(/const prompt = `(You are an expert entertainment recommendation engine[\s\S]*?)`;/)?.[1];
  assert.ok(template);
  let consumerQuery="",body:any;
  await generateSimilarMedia("https://fixture.test","Station Eleven","book","test",{
    fetcher:async(_url,init)=>{consumerQuery=JSON.parse(String(init?.body)).query;return json({recommendations:[]});},
  });
  const models=createLabModels(async()=>({}),"test",async(_url,init)=>{
    body=JSON.parse(String(init?.body));
    return json({usage:{prompt_tokens:100,completion_tokens:20},choices:[{message:{content:'{"recommendations":[]}'}}]});
  });
  const context={dna:{profile_text:"Fixture profile",favorite_media_types:["book"],favorite_genres:["Drama"]},
    recent:[{title:"Fixture",creator:"Author",media_type:"book"}]};
  const result=await models.current("Station Eleven","book",context);
  assert.equal(result.query,consumerQuery);
  assert.equal(body.messages[1].content,template.replaceAll("${query}",consumerQuery)
    .replaceAll("${dnaContext}","User's Entertainment DNA: Fixture profile\nFavorite types: book\nFavorite genres: Drama")
    .replaceAll("${recentMediaText}","Fixture by Author (book)"));
  assert.equal(body.model,"gpt-4o-mini");assert.equal(body.temperature,.7);assert.equal(body.max_tokens,1500);
  assert.deepEqual(body.response_format,{type:"json_object"});
});
test("ranking excludes source, unverified and duplicate identities and never invents a score percentage",()=>{
  const source=work("1"),candidate=work("2",{existing_canonical_id:"same-canonical"});
  const result=rankLab(source,[source,candidate,work("3",{existing_canonical_id:"same-canonical"}),work("4",{source_verified:false})],false);
  assert.equal(result.length,1);assert.equal(result[0].item.id,"2");
  assert.ok(result[0].trace.notes.some(x=>x.includes("not a probability")));
  assert.equal(result[0].score,Object.values(result[0].trace.contributions).reduce((a,b)=>a+b,0));
});
test("dimension-specific semantic scoring rewards appeal separately and exposes missingness",()=>{
  const meta={embedding_model:"text-embedding-3-small",embedding_dimensions:256};
  const source=Object.assign(work("1",{status:"embedded",profile_evidence:{extraction_version:"quoted-1"},appeal_embedding:vector()}),meta);
  const c=Object.assign(work("2",{status:"embedded",profile_evidence:{extraction_version:"quoted-1"},appeal_embedding:vector()}),meta);
  const s=rankLab(source,[c],true)[0];
  assert.equal(s.trace.signals.semantic_appeal,1);assert.equal(s.trace.signals.semantic_tone_style,null);
  assert.equal(s.trace.contributions.semantic_appeal,LAB_WEIGHTS.semantic_appeal);
  assert.ok(s.trace.missing.includes("semantic_tone_style"));
  assert.equal("appeal_embedding" in s.item,false);
  assert.equal(cosine(vector(),vector(1)),0);assert.equal(cosine([],vector()),null);
});
test("incompatible embedding models never share a semantic space",()=>{
  const source=Object.assign(work("1",{status:"embedded",appeal_embedding:vector()}),{embedding_model:"old",embedding_dimensions:256});
  const c=Object.assign(work("2",{status:"embedded",appeal_embedding:vector()}),{embedding_model:"new",embedding_dimensions:256});
  assert.equal(rankLab(source,[c],true)[0].trace.signals.semantic_appeal,null);
});
test("handler denies guests, members, service credentials and forged actors before data or paid work",async()=>{
  for(const authorization of [
    {authorized:false,status:401},{authorized:false,status:403},
    {authorized:true,caller:"service"},{authorized:true,caller:"admin"},
  ]){
    let touched=0;
    const handler=recommendationLabHandler({authorize:async()=>authorization,engine:()=>{touched++;throw Error("Unexpected data access");}});
    const r=await handler(new Request("https://fixture.test",{method:"POST",body:'{"action":"step"}'}));
    assert.ok([401,403].includes(r.status));assert.equal(touched,0);
  }
});
test("handler rejects attempts to change weights, seeds, identity or actor; attributes feedback to session",async()=>{
  let called=0,actor="";
  const handler=recommendationLabHandler({authorize:async()=>({authorized:true,caller:"admin",userId:"session-admin"}),
    engine:(id)=>{actor=id;return {state:async()=>{called++;return {};},step:async()=>({}),
      compare:async()=>({}),evaluate:async()=>{called++;return {saved:true};}};}});
  for(const body of [{action:"state",actor:"other"},{action:"step",weights:{}},{action:"step",seeds:[]},{action:"save_item"}]){
    assert.equal((await handler(new Request("https://fixture.test",{method:"POST",body:JSON.stringify(body)}))).status,400);
  }
  assert.equal(called,0);
  const response=await handler(new Request("https://fixture.test",{method:"POST",body:JSON.stringify({
    action:"evaluate",runId:"00000000-0000-4000-8000-000000000001",variant:"current",candidateId:"provider:42",
    verdict:"Great",reasons:["surprising/great connection"],note:"",
  })}));
  assert.equal(response.status,200);assert.equal(actor,"session-admin");assert.equal(called,1);
});
test("full comparison stores only verified results; unsupported and invented CURRENT outputs stay unavailable",async()=>{
  const actor="fixture-admin",source=work("1",{verification:{source_key:"animals-film"}}),candidate=work("2");
  const actions:string[]=[],saved:any[]=[];
  const engine=createRecommendationLab(async(a,p)=>{
    actions.push(a);
    if(a==="claim")return {token:"claim"};
    if(a==="dataset")return {items:[source,candidate],runs:[],ledger:{progress:{preparation_complete:true}}};
    if(a==="context")return {};
    if(a==="save_run"){saved.push(p);return {id:"new-run"};}
    return {};
  },k=>k==="OPENAI_API_KEY"?"test":undefined,actor,async(url)=>{
    if(String(url).includes("openai.com"))return json({usage:{prompt_tokens:100,completion_tokens:40},
      choices:[{message:{content:JSON.stringify({recommendations:[
        {title:candidate.title,type:"movie"},{title:"Imaginary unsupported game",type:"game"},
      ]})}}]});
    throw Error("Unexpected production/external request");
  });
  assert.deepEqual(await engine.compare("animals-film"),{runId:"new-run",cached:false});
  assert.equal(saved[0].results.current.length,1);assert.equal(saved[0].diagnostics.baseline_unavailable.length,1);
  assert.equal(saved[0].results.current[0].item.source_verified,true);
  assert.deepEqual(actions,["claim","dataset","context","reserve","settle","save_run","release"]);
});
test("cached runs and finished preparation incur no model or provider calls",async()=>{
  let network=0;
  const engine=createRecommendationLab(async(a)=>{
    if(a==="claim")return {token:"lease"};
    if(a==="dataset")return {items:[],runs:[{id:"stored",created_by:"admin",configuration:{sourceKey:"animals-film"}}],
      ledger:{progress:{preparation_complete:true,processed:{}}}};
    return {};
  },()=>undefined,"admin",async()=>{network++;throw Error("Unexpected request");});
  assert.deepEqual(await engine.compare("animals-film"),{runId:"stored",cached:true});
  assert.equal(network,0);
});
test("all provider transport is read-only and untrusted feed hosts are not fetched",async()=>{
  const urls:string[]=[];
  const providers=createLabProviders(()=>undefined,async(url,init)=>{
    urls.push(String(url));assert.equal(init?.method,undefined);
    return json({results:[{collectionName:"Heavyweight",artistName:"Gimlet",kind:"podcast",feedUrl:"http://127.0.0.1/admin"}]});
  });
  const item=await providers.details("itunes","1","podcast");
  assert.equal(item.source_verified,true);assert.equal(item.source_metadata.description,"");
  assert.equal(urls.length,1);assert.ok(urls[0].startsWith("https://itunes.apple.com/lookup"));
});
test("provider deadlines reset per operation, including reusable operator batches",async()=>{
  let network=0;
  const providers=createLabProviders(()=>undefined,async()=>{
    network++;return json({results:[{collectionName:"Album",artistName:"Artist",collectionType:"Album"}]});
  });
  const original=Date.now,now=original();
  try{
    Date.now=()=>now+100_000;
    await assert.rejects(providers.details("itunes","1","music"),/time budget/);
    assert.equal(network,0);
    providers.resetBudget();
    await providers.details("itunes","1","music");
    assert.equal(network,1);
  }finally{Date.now=original;}
});
