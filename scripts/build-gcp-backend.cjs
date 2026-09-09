// Build a backend-only release; never copy credentials or local databases.
const fs=require('node:fs');
const path=require('node:path');
const {builtinModules}=require('node:module');
const esbuild=require('esbuild');
async function main(){
  const out=path.resolve('_local/gcp/backend');
  fs.mkdirSync(out,{recursive:true});
  const result=await esbuild.build({
    entryPoints:{server:'scripts/start-persistent.ts',init:'scripts/init-db-demo.ts',snapshot:'scripts/database-snapshot.ts'},
    outdir:out,bundle:true,platform:'node',format:'cjs',target:'node24',packages:'external',metafile:true,
    // Imported migration modules have CLI guards; they are never release entry points.
    define:{'require.main':'undefined'},
  });
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  const dependencies={};
  for(const output of Object.values(result.metafile.outputs)) for(const item of output.imports){
    if(!item.external || item.path.startsWith('node:') || builtinModules.includes(item.path)) continue;
    const name=item.path.startsWith('@')?item.path.split('/').slice(0,2).join('/'):item.path.split('/')[0];
    const pkg=lock.packages['node_modules/'+name];
    if(!pkg?.version) throw new Error('No locked version for '+name);
    dependencies[name]=pkg.version;
  }
  fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({name:'mai-touch-vm-backend',version:'1.0.0',private:true,scripts:{start:'node server.js'},dependencies},null,2));
  fs.cpSync('migrations',path.join(out,'migrations'),{recursive:true});
  console.log('Backend release prepared:',Object.keys(dependencies).sort().join(', '));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
