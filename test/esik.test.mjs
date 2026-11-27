import test from "node:test";
import assert from "node:assert/strict";
import {siniflandir,yayinKarari} from "../scripts/esik.mjs";
import {gunEkle} from "../scripts/v1-dogrulama.mjs";
const today="2026-11-27";
const rows=(n,start=0)=>Array.from({length:n},(_,i)=>({t:gunEkle(today,start+i).split("-").reverse().join("."),v:["06:00","07:30","12:30","15:00","17:30","19:00"]}));
test("class boundaries (data coverage, fresh stamp): 8 days yedek, 7 or 2 days kisaKapsam, today only / past tukenmis, none eksik",()=>{
 const f=(g)=>({guncelleme:"2026-11-27T00:00:00Z",gunler:g});
 assert.equal(siniflandir(f(rows(8)),today),"yedek");       // today..+7
 assert.equal(siniflandir(f(rows(7)),today),"kisaKapsam");  // today..+6
 assert.equal(siniflandir(f(rows(2)),today),"kisaKapsam");
 assert.equal(siniflandir(f(rows(1)),today),"tukenmis");    // no tomorrow
 assert.equal(siniflandir(f(rows(5,-6)),today),"tukenmis"); // all past
 assert.equal(siniflandir(f([]),today),"tukenmis");
 assert.equal(siniflandir(null,today),"eksik");});
test("mobile 14-day stamp age is applied together with coverage",()=>{
 const g=rows(20);
 assert.equal(siniflandir({guncelleme:"2026-11-19T08:49:17.694Z",gunler:g},today),"kisaKapsam"); // rejected from 03.12 08:49 -> last full day 02.12
 assert.equal(siniflandir({guncelleme:"2026-11-20T00:00:00Z",gunler:g},today),"kisaKapsam");     // last full day 03.12 < today+7
 assert.equal(siniflandir({guncelleme:"2026-11-21T00:00:00Z",gunler:g},today),"yedek");          // last full day 04.12 = today+7
 assert.equal(siniflandir({guncelleme:"2026-11-14T00:00:00Z",gunler:g},today),"tukenmis");        // rejected from 28.11 -> tomorrow not accepted
 assert.equal(siniflandir({guncelleme:"2026-11-13T00:00:00Z",gunler:g},today),"tukenmis");        // already rejected today
 assert.equal(siniflandir({gunler:g},today),"tukenmis");                                           // no stamp
 assert.equal(siniflandir({guncelleme:"bozuk",gunler:g},today),"tukenmis");});
const d=(x)=>({toplam:869,basarili:0,yedek:[],kisaKapsam:[],tukenmis:[],eksik:[],bilinenEksik:[33292],...x});
const ids=(n,from=1)=>Array.from({length:n},(_,i)=>from+i);
test("production denominators: 868 active, 17 source failures and 8 unusable are the maxima",()=>{
 let r=yayinKarari(d({basarili:851,yedek:ids(9),eksik:ids(8,100)}));assert.equal(r.yayinla,true);assert.equal(r.aktif,868);assert.equal(r.sinirKaynakHatasi,17);assert.equal(r.sinirKullanilamaz,8);
 r=yayinKarari(d({basarili:850,yedek:ids(10),eksik:ids(8,100)}));assert.equal(r.yayinla,false);assert.match(r.sebep,/kaynak hatası 18 > 17/);
 r=yayinKarari(d({basarili:859,tukenmis:ids(9)}));assert.equal(r.yayinla,false);assert.match(r.sebep,/kullanılamaz 9 > 8/);});
test("known exception excluded from ratios even if its file is missing",()=>{
 const r=yayinKarari(d({basarili:868,eksik:[33292]}));assert.equal(r.yayinla,true);assert.equal(r.eksik,0);assert.equal(r.bilinenEksik,1);});
test("short coverage counts as source failure but not as unusable",()=>{
 const r=yayinKarari(d({basarili:851,kisaKapsam:ids(17)}));assert.equal(r.yayinla,true);assert.equal(r.kullanilamaz,0);
 assert.equal(yayinKarari(d({basarili:850,kisaKapsam:ids(18)})).yayinla,false);});
test("total exhaustion and inconsistent counts never publish",()=>{
 assert.equal(yayinKarari(d({tukenmis:ids(868)})).yayinla,false);
 assert.equal(yayinKarari(d({basarili:868,yedek:[1]})).yayinla,false);
 assert.equal(yayinKarari({toplam:1,basarili:0,yedek:[],kisaKapsam:[],tukenmis:[],eksik:[],bilinenEksik:[1]}).yayinla,false);});
test("D06 A'+C: waiting districts never block; their unusable count only raises a nationwide warning",()=>{
 let r=yayinKarari(d({basarili:100,planliBekleyen:ids(768,1000)}));assert.equal(r.yayinla,true);assert.equal(r.denenen,100);assert.equal(r.kaynakHatasi,0);assert.equal(r.kritikUyari,false);
 r=yayinKarari(d({basarili:90,planliBekleyen:ids(778,1000),planliKullanilamaz:778}));assert.equal(r.yayinla,true);assert.equal(r.kritikUyari,true);assert.equal(r.turkiyeKullanilamaz,778); // mass staleness
 assert.equal(yayinKarari(d({basarili:97,yedek:ids(3),planliBekleyen:ids(768,1000)})).yayinla,false); // 3 > max(1,2)
 assert.equal(yayinKarari(d({basarili:98,yedek:ids(2),planliBekleyen:ids(768,1000)})).yayinla,true);
 assert.equal(yayinKarari(d({basarili:0,planliBekleyen:ids(868,1000)})).yayinla,false);});
test("small batches: at least one source failure tolerated; single unusable recovered only with other successes; zero success never publishes",()=>{
 const small=(x)=>d({planliBekleyen:ids(868-5,2000),...x}); // 5 attempted
 let r=yayinKarari(small({basarili:4,yedek:[1]}));assert.equal(r.yayinla,true);assert.equal(r.sinirKaynakHatasi,1);
 assert.equal(yayinKarari(small({basarili:3,yedek:[1,2]})).yayinla,false);
 r=yayinKarari(small({basarili:4,eksik:[1]}));assert.equal(r.yayinla,true);assert.equal(r.sinirKullanilamaz,1);   // controlled recovery
 assert.equal(yayinKarari(small({basarili:3,eksik:[1],tukenmis:[2]})).yayinla,false);
 const one=d({planliBekleyen:ids(867,2000),basarili:0,eksik:[1]});r=yayinKarari(one);assert.equal(r.yayinla,false);assert.equal(r.sebep,"başarılı ilçe yok");
 assert.equal(yayinKarari(d({planliBekleyen:ids(867,2000),basarili:1})).yayinla,true);});
test("full-run thresholds unchanged at production scale (868 attempted): 17 / 8",()=>{
 assert.equal(yayinKarari(d({basarili:851,yedek:ids(9),eksik:ids(8,100)})).yayinla,true);
 assert.equal(yayinKarari(d({basarili:850,yedek:ids(9),eksik:ids(9,100)})).yayinla,false);});
test("priority selection: least remaining coverage first, missing files first, ties by id",async()=>{const {dilimSec}=await import("../scripts/esik.mjs");
 const a=[{id:5,sonGun:"2026-12-20"},{id:3,sonGun:"2026-12-13"},{id:9,sonGun:null},{id:1,sonGun:"2026-12-13"}];
 assert.deepEqual([...dilimSec(a,3)].sort((x,y)=>x-y),[1,3,9]);assert.equal(dilimSec(a,undefined).size,4);assert.throws(()=>dilimSec(a,0));});
test("mobile usability date: min(last data day, stamp + 14 days)",async()=>{const {sonKullanim}=await import("../scripts/esik.mjs");
 const f=(stamp,last)=>({guncelleme:stamp,gunler:[{t:last.split("-").reverse().join("."),v:[]}]});
 assert.equal(sonKullanim(f("2026-11-19T08:49:17.694Z","2026-12-19")),"2026-12-02"); // stale stamp limits (last full day)
 assert.equal(sonKullanim(f("2026-11-27T00:00:00Z","2026-12-05")),"2026-12-05");    // data end limits
 assert.equal(sonKullanim(null),null);});
