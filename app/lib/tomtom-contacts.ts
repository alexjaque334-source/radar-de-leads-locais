/** Pure extraction for the TomTom Places Search v3 Discover/Details "contacts" field.
 * Both services publish contacts as an array of { type, phones: string[], websites: string[] }.
 * Accept a few backward-compatible object forms, but never synthesize unavailable data.
 */
type ContactKind = "phones" | "websites";
type UnknownRecord = Record<string, unknown>;
const record=(v:unknown):v is UnknownRecord=>!!v&&typeof v==="object"&&!Array.isArray(v);
const stringField=(v:unknown,keys:string[]):string=>{
  if(typeof v==="string")return v.trim();
  if(!record(v))return "";
  for(const key of keys)if(typeof v[key]==="string")return (v[key] as string).trim();
  return "";
};
export function extractTomtomContacts(raw:unknown) {
  const items=Array.isArray(raw)?raw.filter(record):[];
  const values=(key:ContactKind)=>{
    const collected:string[]=[];
    for(const contact of items){
      const entries=Array.isArray(contact[key])?contact[key] as unknown[]:[contact[key==="phones"?"phone":"website"]];
      for(const entry of entries){
        const candidate=stringField(entry,key==="phones"?["value","number","phoneNumber"]:["value","url","address","website"]);
        if(candidate&&!collected.includes(candidate))collected.push(candidate);
      }
    }
    return collected;
  };
  const phones=values("phones").filter(x=>{const digits=x.replace(/\D/g,"");return digits.length>=8&&digits.length<=15}).slice(0,8);
  const websites=values("websites").filter(x=>{
    try{const u=new URL(/^https?:\/\//i.test(x)?x:"https://"+x);return ["http:","https:"].includes(u.protocol)&&!!u.hostname.includes(".")&&!u.username&&!u.password}catch{return false}
  }).slice(0,8);
  return {phones,websites,phone:phones[0]||"",website:websites[0]||""};
}
export function tomtomAddress(raw:unknown,subtitles:unknown):string{
  const a=record(raw)?raw:{};
  const parts=[a.street,a.houseNumber,a.municipalitySubdivision,a.municipality,a.countrySubdivision,a.postalCode].filter((s):s is string=>typeof s==="string"&&!!s.trim()).map(x=>x.trim());
  if(parts.length)return parts.join(", ").slice(0,350);
  if(Array.isArray(subtitles)){
    const lines=subtitles.filter((s):s is string=>typeof s==="string"&&!!s.trim()).slice(0,3);
    if(lines.length)return lines.join(", ").slice(0,350);
  }
  return "Endereço não informado pela TomTom";
}
