import fs from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
// Stage every file before replacing any destination. Each rename is atomic.
// Roll back completed replacements on ordinary errors; not a crash-atomic directory transaction.
export async function yazToplu(entries, {beforeRename=async()=>{}}={}) {
  const staged=[], done=[];
  try {
    for(const [dest,data,indent] of entries) {
      await fs.mkdir(path.dirname(dest),{recursive:true});
      const tmp=dest+"."+randomUUID()+".tmp";
      let old;
      try { old=await fs.readFile(dest); } catch(e) {if(e.code!=="ENOENT") throw e;}
      staged.push({dest,tmp,old});
      const f=await fs.open(tmp,"wx");
      try {await f.writeFile(JSON.stringify(data,null,indent)+"\n");await f.sync();} finally {await f.close();}
    }
    for(const item of staged) {
      await beforeRename(item.dest);
      await fs.rename(item.tmp,item.dest);
      done.push(item);
    }
  } catch(e) {
    const errors=[];
    for(const item of done.reverse()) {
      try {
        if(item.old===undefined) await fs.unlink(item.dest);
        else {
          const tmp=item.dest+"."+randomUUID()+".rollback";
          try {await fs.writeFile(tmp,item.old,{flag:"wx"});await fs.rename(tmp,item.dest);}
          finally {await fs.rm(tmp,{force:true});}
        }
      } catch(err){errors.push(err);}
    }
    if(errors.length) throw new AggregateError([e,...errors],"write and rollback failed");
    throw e;
  } finally {await Promise.all(staged.map(x=>fs.rm(x.tmp,{force:true})));}
}
