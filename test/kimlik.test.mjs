import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {gecisDogrula,ilceBirlestir,kimlikGecisiDogrula,onayliEklemeler} from "../scripts/kimlik.mjs";
import {eslesmeDogrula} from "../scripts/eslesme-dogrula.mjs";
const onay={kim:"Ali Doğan Mutlu",tarih:"2026-11-27",gerekce:"Diyanet yeni ilçe"};
test("source drop keeps saved identity; unapproved addition rejected; approved accepted",()=>{
 const prev=[{id:1,ad:"A"},{id:2,ad:"B"}];
 const r=ilceBirlestir(prev,[{id:1,ad:"A2"},{id:3,ad:"C"}],new Set());
 assert.deepEqual(r.liste,[{id:1,ad:"A2"},{id:2,ad:"B"}]);assert.deepEqual(r.kaynaktaYok,[2]);assert.deepEqual(r.reddedilen,[3]);
 assert.deepEqual(ilceBirlestir(prev,[{id:3,ad:"C"}],new Set([3])).liste.map(x=>x.id),[1,2,3]);
 assert.deepEqual(ilceBirlestir(null,[{id:9,ad:"X"}]).liste,[{id:9,ad:"X"}]);});
test("publish identity rules",()=>{
 assert.throws(()=>kimlikGecisiDogrula([{id:1}],[{id:1},{id:2}]),/removed/);
 assert.throws(()=>kimlikGecisiDogrula([{id:1},{id:3}],[{id:1}]),/without approved/);
 kimlikGecisiDogrula([{id:1},{id:3}],[{id:1}],new Set([3]));});
test("migration list requires explicit approval and supports only additions",()=>{
 gecisDogrula({surum:1,gecisler:[{tur:"ekle",id:5,ilId:1,ad:"Y",onay}]});
 for(const bad of [{tur:"kaldir",id:5,ilId:1,onay},{tur:"ekle",id:5,ilId:1},{tur:"ekle",id:5,ilId:1,onay:{...onay,gerekce:""}},{tur:"ekle",id:-1,ilId:1,onay}])assert.throws(()=>gecisDogrula({surum:1,gecisler:[bad]}));
 assert.deepEqual([...onayliEklemeler({gecisler:[{tur:"ekle",id:5,ilId:1,onay}]}).get(1)],[5]);});
test("committed mapping table covers every published district and approvals file is valid",async()=>{
 const t=JSON.parse(await fs.readFile("eslesme/ilce-kimlikleri.json"));const ids=[];
 for(const il of JSON.parse(await fs.readFile("docs/v1/iller.json")))for(const x of JSON.parse(await fs.readFile(`docs/v1/ilceler/${il.id}.json`)))ids.push(x.id);
 eslesmeDogrula(t,ids);assert.equal(ids.length,869);gecisDogrula(JSON.parse(await fs.readFile("eslesme/onayli-gecisler.json")));
 assert.throws(()=>eslesmeDogrula(t,[...ids,123456789]));
 const dup=structuredClone(t);const [a,b]=Object.keys(dup.ilceler);dup.ilceler[a].resmi=7;dup.ilceler[b].resmi=7;dup.ilceler[a].dogrulama=dup.ilceler[b].dogrulama={tarih:"2026-11-27"};assert.throws(()=>eslesmeDogrula(dup,ids),/tekrarlanan resmi/);});
