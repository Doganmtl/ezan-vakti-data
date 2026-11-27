import test from "node:test";
import assert from "node:assert/strict";
import {siniflandir,yayinKarari} from "../scripts/esik.mjs";
import {gunEkle} from "../scripts/v1-dogrulama.mjs";
const today="2026-11-27";
const rows=(n,start=0)=>Array.from({length:n},(_,i)=>({t:gunEkle(today,start+i).split("-").reverse().join("."),v:["06:00","07:30","12:30","15:00","17:30","19:00"]}));
test("class boundaries: 8 days yedek, 7 or 2 days kisaKapsam, today only / past tukenmis, none eksik",()=>{
 assert.equal(siniflandir({gunler:rows(8)},today),"yedek");       // today..+7
 assert.equal(siniflandir({gunler:rows(7)},today),"kisaKapsam");  // today..+6
 assert.equal(siniflandir({gunler:rows(2)},today),"kisaKapsam");
 assert.equal(siniflandir({gunler:rows(1)},today),"tukenmis");    // no tomorrow
 assert.equal(siniflandir({gunler:rows(5,-6)},today),"tukenmis"); // all past
 assert.equal(siniflandir({gunler:[]},today),"tukenmis");
 assert.equal(siniflandir(null,today),"eksik");});
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
test("staged updates: unplanned districts are not source failures; unusable ones still count",()=>{
 const r=yayinKarari(d({basarili:100,planliBekleyen:ids(768,1000)}));assert.equal(r.yayinla,true);assert.equal(r.planli,100);assert.equal(r.kaynakHatasi,0);
 assert.equal(yayinKarari(d({basarili:97,yedek:ids(3),planliBekleyen:ids(768,1000)})).yayinla,false); // 3/100 > 2%
 assert.equal(yayinKarari(d({basarili:100,planliBekleyen:ids(768,1000),planliKullanilamaz:9})).yayinla,false);
 assert.equal(yayinKarari(d({basarili:100,planliBekleyen:ids(768,1000),planliKullanilamaz:8})).yayinla,true);
 assert.equal(yayinKarari(d({basarili:0,planliBekleyen:ids(868,1000)})).yayinla,false);});
test("priority selection: least remaining coverage first, missing files first, ties by id",async()=>{const {dilimSec}=await import("../scripts/esik.mjs");
 const a=[{id:5,sonGun:"2026-12-20"},{id:3,sonGun:"2026-12-13"},{id:9,sonGun:null},{id:1,sonGun:"2026-12-13"}];
 assert.deepEqual([...dilimSec(a,3)].sort((x,y)=>x-y),[1,3,9]);assert.equal(dilimSec(a,undefined).size,4);assert.throws(()=>dilimSec(a,0));});
test("mobile usability date: min(last data day, stamp + 14 days)",async()=>{const {sonKullanim}=await import("../scripts/esik.mjs");
 const f=(stamp,last)=>({guncelleme:stamp,gunler:[{t:last.split("-").reverse().join("."),v:[]}]});
 assert.equal(sonKullanim(f("2026-11-19T08:49:17.694Z","2026-12-19")),"2026-12-03"); // stale stamp limits
 assert.equal(sonKullanim(f("2026-11-27T00:00:00Z","2026-12-05")),"2026-12-05");    // data end limits
 assert.equal(sonKullanim(null),null);});
