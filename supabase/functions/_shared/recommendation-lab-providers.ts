// Provider READS only. Never call shared search/canonical/enrichment endpoints.
export type LabSeed = { title: string; type: string; creator?: string; year?: number };
export const normalize = (v: unknown) => String(v || "").normalize("NFKD").replace(/\p{M}/gu,"")
  .toLowerCase().replace(/&/g," and ").replace(/[^\p{L}\p{N}]+/gu," ").trim();
export const mediaType = (v: string) => ({ "tv show":"tv",album:"music",track:"music",song:"music" }[v.toLowerCase()] || v.toLowerCase());
export function matches(seed: LabSeed, value: { title: string; creator?: string; type: string; year?: number }) {
  const title=(v:string)=>mediaType(seed.type)==="music"?normalize(v).replace(/ (?:\d{4} )?(?:remaster(?:ed)?(?: version)?|remix|deluxe(?: edition)?|expanded edition)(?: \d{4})?$/,""):normalize(v).replace(/ podcast$/,"");
  const expected=title(seed.title);
  return expected===title(value.title) && mediaType(seed.type)===mediaType(value.type)
    && (!seed.year || Number(seed.year)===Number(value.year))
    && (!seed.creator || seed.creator.split("/").some(c=>normalize(value.creator).includes(normalize(c))));
}
const clean = (v: unknown, max=7000) => String(v || "").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/\s+/g," ").trim().slice(0,max);
export function createLabProviders(env: (k: string)=>string|undefined, fetcher: typeof fetch=fetch) {
  let calls=0;
  let deadline=Date.now()+90_000;
  function timeout(max:number){
    const remaining=deadline-Date.now();
    if(remaining<=0)throw new Error("Provider resolution time budget exhausted");
    return AbortSignal.timeout(Math.min(max,remaining));
  }
  async function json(url: string) {
    calls++;
    const r=await fetcher(url,{signal:timeout(12_000),redirect:"error"});
    if(!r.ok)throw new Error(`Provider returned HTTP ${r.status}`);
    return r.json();
  }
  const tmdb = (route:string) => {
    const key=env("TMDB_API_KEY"); if(!key)throw new Error("TMDB credential unavailable");
    return `https://api.themoviedb.org/3/${route}${route.includes("?")?"&":"?"}api_key=${encodeURIComponent(key)}`;
  };
  async function podcastDescription(feed: string) {
    // A small allowlist prevents provider-supplied feeds becoming arbitrary SSRF.
    const u=new URL(feed);
    const allowed=["feeds.megaphone.fm","feeds.simplecast.com","feeds.thisamericanlife.org","stownpodcast.org","feeds.serialpodcast.org","feeds.acast.com","feeds.publicradio.org","www.thisamericanlife.org","feeds.feedburner.com"];
    if(u.protocol!=="https:" || !allowed.includes(u.hostname))return "";
    calls++;
    const r=await fetcher(u,{signal:timeout(10_000),redirect:"error"});
    if(!r.ok)return "";
    const reader=r.body?.getReader(); if(!reader)return "";
    let text="",bytes=0; const decoder=new TextDecoder();
    try {
      while(bytes<120000){const x=await reader.read();if(x.done)break;bytes+=x.value.length;text+=decoder.decode(x.value,{stream:true});if(text.includes("<item>"))break;}
    } finally { await reader.cancel().catch(()=>{}); }
    const channel=text.split(/<item[\s>]/i)[0];
    return clean((channel.match(/<(?:itunes:summary|description)>([\s\S]*?)<\/(?:itunes:summary|description)>/i)?.[1]||"").replace(/<!\[CDATA\[|\]\]>/g,""));
  }
  async function details(source:string,id:string,type:string): Promise<any> {
    type=mediaType(type); let metadata:any, recommendations:any[]=[];
    if(source==="tmdb"){
      if(!["movie","tv"].includes(type))throw new Error("Unsupported TMDB identity type");
      const d=await json(tmdb(`${type}/${encodeURIComponent(id)}?append_to_response=credits,keywords,recommendations`));
      const creator=type==="movie" ? d.credits?.crew?.find((x:any)=>x.job==="Director")?.name : d.created_by?.map((x:any)=>x.name).join(", ");
      metadata={title:d.title||d.name,creator:creator||"",description:clean(d.overview),
        subjects:(d.genres||[]).map((g:any)=>g.name),keywords:(d.keywords?.keywords||d.keywords?.results||[]).map((k:any)=>k.name),
        release_year:Number((d.release_date||d.first_air_date||"").slice(0,4))||null,
        collection:d.belongs_to_collection?.name||null,poster_url:d.poster_path?`https://image.tmdb.org/t/p/w342${d.poster_path}`:""};
      recommendations=(d.recommendations?.results||[]).slice(0,3).map((r:any,index:number)=>({source:"tmdb",id:String(r.id),type,title:r.title||r.name,position:index+1}));
    } else if(source==="googlebooks"){
      const key=env("GOOGLE_BOOKS_API_KEY");
      const d=await json(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}${key?`?key=${encodeURIComponent(key)}`:""}`); const v=d.volumeInfo;
      if(!v)throw new Error("Book metadata missing");
      metadata={title:v.title,creator:(v.authors||[]).join(", "),description:clean(v.description),subjects:v.categories||[],
        isbn_identifiers:(v.industryIdentifiers||[]).map((x:any)=>x.identifier),release_year:Number((v.publishedDate||"").slice(0,4))||null,
        poster_url:(v.imageLinks?.thumbnail||"").replace(/^http:/,"https:")};
    } else if(source==="openlibrary"||source==="open_library"){
      const workId=id.replace(/^\/?works\//,"");
      if(!/^OL\d+W$/.test(workId))throw new Error("Only exact Open Library works are supported in this checkpoint");
      const d=await json(`https://openlibrary.org/works/${workId}.json`);
      const authorKey=d.authors?.[0]?.author?.key;
      const author=authorKey&&/^\/authors\/OL\d+A$/.test(authorKey)?await json(`https://openlibrary.org${authorKey}.json`):null;
      metadata={title:d.title,creator:author?.name||d.by_statement||"",description:clean(typeof d.description==="string"?d.description:d.description?.value),
        subjects:(d.subjects||[]).slice(0,16),open_library_work_id:workId,release_year:Number((d.first_publish_date||"").match(/\d{4}/)?.[0])||null,
        poster_url:d.covers?.[0]?`https://covers.openlibrary.org/b/id/${d.covers[0]}-M.jpg`:""};
    } else if(source==="itunes"){
      if(!/^\d+$/.test(id))throw new Error("Invalid Apple identity");
      const d=await json(`https://itunes.apple.com/lookup?id=${id}&country=US`);const v=d.results?.[0];
      if(!v)throw new Error("Apple item unavailable");
      const actualType=v.kind==="podcast"||v.collectionType==="Podcast"?"podcast":"music";
      if(type!==actualType)throw new Error("Provider media type mismatch");
      let description=clean(v.description||v.longDescription);
      if(type==="podcast"&&!description&&v.feedUrl){try{description=await podcastDescription(v.feedUrl);}catch{/* retain missing evidence */}}
      metadata={title:v.wrapperType==="track"&&v.kind!=="podcast"?v.trackName:(v.collectionName||v.trackName),
        creator:v.artistName||"",description,subjects:v.genres||[v.primaryGenreName].filter(Boolean),
        release_year:Number((v.releaseDate||"").slice(0,4))||null,
        poster_url:v.artworkUrl600||v.artworkUrl100||"",feed_description_used:!!description&&!!v.feedUrl};
    } else throw new Error("Provider destination is not supported in this checkpoint");
    if(!metadata?.title)throw new Error("Provider returned no title");
    return {external_source:source,external_id:id,media_type:type,title:metadata.title,source_metadata:metadata,
      source_verified:true,destination_path:`/media/${type}/${source}/${id.split("/").map(encodeURIComponent).join("/")}`,
      verification:{method:"exact_provider_id",verified_at:new Date().toISOString(),recommendations},profile:{},status:"verified"};
  }
  async function search(seed:LabSeed):Promise<any[]>{
    const type=mediaType(seed.type);
    if(type==="movie"||type==="tv"){
      const d=await json(tmdb(`search/${type}?query=${encodeURIComponent(seed.title)}`));
      return (d.results||[]).slice(0,4).map((x:any)=>({external_source:"tmdb",external_id:String(x.id),media_type:type}));
    }
    if(type==="book"){
      const d=await json(`https://openlibrary.org/search.json?title=${encodeURIComponent(seed.title)}&author=${encodeURIComponent(seed.creator||"")}&limit=3`);
      return (d.docs||[]).slice(0,3).map((x:any)=>({external_source:"openlibrary",external_id:x.key,media_type:type}));
    }
    if(type==="music"||type==="podcast"){
      const d=await json(`https://itunes.apple.com/search?term=${encodeURIComponent(`${seed.title} ${seed.creator||""}`)}&media=${type==="music"?"music":"podcast"}&entity=${type==="music"?"album":"podcast"}&limit=4&country=US`);
      return (d.results||[]).map((x:any)=>({external_source:"itunes",external_id:String(x.collectionId||x.trackId),media_type:type}));
    }
    return [];
  }
  async function resolve(seed:LabSeed,catalog:any[]=[]){
    const candidates=catalog.filter(x=>matches(seed,{...x.source_metadata,type:mediaType(x.media_type),year:x.source_metadata.release_year}))
      .sort((a,b)=>(a.external_source==="tmdb"?-1:0)-(b.external_source==="tmdb"?-1:0));
    const errors:string[]=[];
    for(const c of candidates.slice(0,2)){
      try { const w=await details(c.external_source,c.external_id,seed.type);
        if(matches(seed,{title:w.title,creator:w.source_metadata.creator,type:w.media_type,year:w.source_metadata.release_year})){
          w.existing_canonical_id=c.existing_canonical_id;
          w.source_metadata.story_key=c.story_key||null;
          return {work:w,errors};
        }
      }catch(e){errors.push((e as Error).message);}
    }
    let found:any[]=[];try{found=await search(seed);}catch(e){errors.push((e as Error).message);}
    for(const c of found.slice(0,3)){
      try{const w=await details(c.external_source,c.external_id,seed.type);
        if(matches(seed,{title:w.title,creator:w.source_metadata.creator,type:w.media_type,year:w.source_metadata.release_year}))return {work:w,errors};
      }catch(e){errors.push((e as Error).message);}
    }
    return {work:null,errors:[...errors,"No exact title/type/creator match verified"]};
  }
  return {details,resolve,resetBudget(){deadline=Date.now()+90_000;calls=0;},get calls(){return calls;}};
}
