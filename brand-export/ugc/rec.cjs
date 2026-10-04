// Enregistre l'appli (données de démonstration fictives) en vidéo mobile. Usage: node rec.cjs 1|2|3
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const uid='11111111-1111-1111-1111-111111111111';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const exp=Math.floor(Date.now()/1000)+99999;
const jwt=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,aud:'authenticated',role:'authenticated',aal:'aal2',exp,amr:[{method:'password',timestamp:1}],email:'demo@konvwa.shop'})}.sig`;
const user={id:uid,aud:'authenticated',role:'authenticated',email:'demo@konvwa.shop',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:jwt,refresh_token:'r',token_type:'bearer',expires_in:99999,expires_at:exp,user};
const profile={id:'p1',user_id:uid,full_name:'Marie Joseph',phone:'+509 3700 0000',role:'client',avatar_url:null,created_at:new Date().toISOString(),onboarding_completed_at:new Date().toISOString(),onboarding_skipped:[],account_status:'active',restrictions:[],language:'fr'};
const ago=m=>new Date(Date.now()-m*60000).toISOString();
const ORDER='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TABLES={
  profiles:profile,
  wallets:{id:'w1',available_balance:18500,blocked_balance:0,user_id:uid},
  wallet_transactions:[
    {id:'t1',type:'deposit',amount:10000,status:'completed',payment_method:'moncash',description:'Recharge MonCash',reference:'MC-73021',proof_url:null,created_at:ago(60*26)},
    {id:'t2',type:'payment',amount:6450,status:'completed',payment_method:'wallet',description:'Paiement commande catalogue',reference:null,proof_url:null,created_at:ago(60*20)},
    {id:'t3',type:'deposit',amount:15000,status:'completed',payment_method:'natcash',description:'Recharge NatCash',reference:'NC-55120',proof_url:null,created_at:ago(60*72)}],
  notifications:[
    {id:'n1',title:'Votre colis est arrivé en Haïti',title_en:null,message:'Commande KV-48213 : prête pour la livraison.',body_en:null,type:'success',read:false,created_at:ago(6),link:'/product-orders/'+ORDER},
    {id:'n2',title:'Votre devis est prêt',title_en:null,message:'Consultez le détail des frais et acceptez votre devis.',body_en:null,type:'info',read:false,created_at:ago(55),link:'/orders'},
    {id:'n3',title:'Paiement confirmé',title_en:null,message:'Votre paiement de 6 450 HTG a été reçu.',body_en:null,type:'success',read:false,created_at:ago(60*20),link:'/wallet'}],
  product_orders:{id:ORDER,tracking_code:'KV-48213',status:'shipped',payment_status:'paid',tracking_status:'in_transit',total_htg:6450,created_at:ago(60*72),shipping_paid_at:ago(60*40),shipping_amount_htg:1850,chosen_shipping_rate:{name:'Aérien'}},
  product_order_items:[{id:'i1',product_name:'Montre connectée sport',product_price_htg:3200,quantity:1,subtotal_htg:3200},{id:'i2',product_name:'Écouteurs sans fil',product_price_htg:1400,quantity:1,subtotal_htg:1400}],
  shipping_origins:[{id:'o1',name:'Chine',flag_emoji:'',country_code:'CN'}],
  haiti_regions:[{id:'r1',name:'Ouest'}],
};
let tracking='in_transit';
const which=+process.argv[2]||1;
const SCENES={
 1:[['dash',3.5],['submit',8],['notif',5],['wallet',5],['order',6]],
 2:[['wallet',4],['dialog',6],['wallet2',4],['order',4]],
 3:[['notif',5],['order',6],['delivered',6]],
};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,hasTouch:true});
  const t0=Date.now();
  await ctx.addInitScript(s=>{localStorage.setItem('sb-fake-auth-token',JSON.stringify(s));localStorage.setItem('konvwa-push-dismissed','1');localStorage.setItem('konvwa-install-dismissed','1');localStorage.setItem('konvwa_onboarded','1');localStorage.setItem('konvwa_onboarding_seen','1')},session);
  await ctx.route('https://fake.supabase.co/**',async r=>{
    const req=r.request();const u=req.url();const acc=req.headers()['accept']||'';
    const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
    if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:h});
    const one=acc.includes('vnd.pgrst.object');let body=[];let status=200;
    if(u.includes('/auth/v1/user'))body=user;
    else if(u.includes('/auth/v1/factors')||u.includes('/mfa'))body={all:[],totp:[],phone:[]};
    else if(u.includes('/rest/v1/rpc/')){const n=u.split('/rpc/')[1].split('?')[0];body=n==='my_loyalty'?{tier:'bronze',points:0}:n==='admin_badge_counts'?{}:{success:true};}
    else if(u.includes('/rest/v1/')){
      const t=u.split('/rest/v1/')[1].split('?')[0];let d=TABLES[t];
      if(t==='product_orders'&&d)d={...d,tracking_status:tracking,status:tracking==='delivered'?'delivered':'shipped'};
      if(d===undefined){body=one?{}:[];if(one)status=406;}
      else if(Array.isArray(d))body=one?d[0]:d; else body=one?d:[d];
      if(one&&d===undefined){status=406}
    }
    r.fulfill({status,headers:h,body:JSON.stringify(body)});
  });
  const p=await ctx.newPage();
  const frames=[];let capturing=false;
  await p.goto('http://localhost:4177/dashboard',{waitUntil:'networkidle'});
  await p.waitForTimeout(2600);
  capturing=true;
  const loop=(async()=>{while(capturing){const t=Date.now();try{const buf=await p.screenshot({type:'jpeg',quality:88});frames.push({t:t/1000,d:buf.toString('base64')});}catch(e){}}})();
  await p.waitForTimeout(300);
  const nav=async path=>{await p.evaluate(x=>{history.pushState({},'',x);dispatchEvent(new PopStateEvent('popstate'))},path);await p.waitForTimeout(700)};
  const marks=[];const start=Date.now();
  const mark=n=>marks.push({n,t:(Date.now()-start)/1000});
  const dwell=s=>p.waitForTimeout(s*1000);
  const scroll=async y=>{await p.evaluate(v=>{const el=document.querySelector('main')||document.scrollingElement;(el.scrollTo?el:window).scrollTo({top:v,behavior:'smooth'})},y)};
  for(const [name,dur] of SCENES[which]){
    mark(name);const t=Date.now();
    if(name==='dash'){ await dwell(dur); }
    else if(name==='submit'){ await nav('/submit'); await dwell(1);
      const inp=p.getByPlaceholder('Colle le lien ici'); await inp.click();
      await inp.pressSequentially('https://www.aliexpress.com/item/1005006123456.html',{delay:45}); await dwell(1); }
    else if(name==='notif'){ tracking='in_transit'; await nav('/notifications'); await dwell(dur-0.7); }
    else if(name==='wallet'||name==='wallet2'){ await nav('/wallet'); await dwell(1.2); await scroll(260); await dwell(dur-2); }
    else if(name==='dialog'){ await p.getByRole('button',{name:'Recharger'}).first().click().catch(()=>{}); await dwell(dur); }
    else if(name==='order'){ tracking='in_transit'; await nav('/product-orders/'+ORDER); await dwell(1.5); await scroll(300); await dwell(dur-2.2); }
    else if(name==='delivered'){ tracking='delivered'; await nav('/notifications'); await nav('/product-orders/'+ORDER); await dwell(1.5); await scroll(300); await dwell(dur-2.2); }
    const rest=dur*1000-(Date.now()-t); if(rest>0) await p.waitForTimeout(rest);
  }
  mark('end');
  capturing=false;await loop;
  const dir=`raw/f${which}`;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  let list='';
  frames.forEach((f,k)=>{const fn=`${dir}/${String(k).padStart(5,'0')}.jpg`;fs.writeFileSync(fn,Buffer.from(f.d,'base64'));const dur=k<frames.length-1?frames[k+1].t-f.t:0.05;list+=`file '${process.cwd()}/${fn}'\nduration ${Math.max(dur,0.001).toFixed(4)}\n`;});
  list+=`file '${process.cwd()}/${dir}/${String(frames.length-1).padStart(5,'0')}.jpg'\n`;
  fs.writeFileSync(`raw/v${which}.txt`,list);
  const total=frames[frames.length-1].t-frames[0].t;
  const t00=frames[0].t;
  fs.writeFileSync(`raw/v${which}.json`,JSON.stringify({marks,frames:frames.length,total,off:start/1000-frames[0].t}));
  await ctx.close();await b.close();
  console.log('ok',which,frames.length,total.toFixed(1),JSON.stringify(marks));
})();
