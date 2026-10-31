import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

function load(file, imports = {}, globals = {}, extra = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require(name) { assert.ok(name in imports, `Unexpected import ${name} in ${file}`); return imports[name]; }, console, URL, AbortController, Response, setTimeout, clearTimeout, queueMicrotask, Date, process: { env: { EXPO_PUBLIC_API_URL: 'https://example.test' } }, ...globals }, { filename: file });
  return exports;
}
function renderer() {
  let owner;
  const hooks = {
    useState(initial) { const h=owner, i=h.i++; h.slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [h.slots[i].value, next=>{const v=typeof next==='function'?next(h.slots[i].value):next;if(!Object.is(v,h.slots[i].value)){h.slots[i].value=v;h.dirty=true;}}]; },
    useRef(initial) { const h=owner,i=h.i++; return h.slots[i] ??= { current:initial }; },
    useMemo(fn,deps) { const h=owner,i=h.i++,old=h.slots[i];if(!old||deps.some((x,n)=>!Object.is(x,old.deps[n])))h.slots[i]={value:fn(),deps};return h.slots[i].value; },
    useCallback(fn,deps) { return hooks.useMemo(()=>fn,deps); },
    useEffect(fn,deps) { const h=owner,i=h.i++,old=h.effects[i];if(!old||deps.some((x,n)=>!Object.is(x,old.deps[n])))h.pending.push(()=>{old?.cleanup?.();h.effects[i]={deps,cleanup:fn()};}); },
    useSyncExternalStore(_subscribe,get) { return get(); },
  };
  hooks.useLayoutEffect=hooks.useEffect;
  function mount(fn,props) { const h={i:0,slots:[],effects:[],pending:[],props,dirty:true,render(next=h.props){h.props=next;let n=0;do{assert.ok(n++<25,'Unstable hook render');owner=h;h.i=0;h.dirty=false;h.output=fn(h.props);h.pending.splice(0).forEach(f=>f());}while(h.dirty);return h.output;},unmount(){h.effects.forEach(x=>x?.cleanup?.());}};h.render();return h; }
  return {hooks,mount};
}
const tick=()=>new Promise(r=>setImmediate(r));

function apiRuntime() {
  let now=1000, requests=0, aborts=0;
  const calls=[], storage=new Map();
  class Clock extends Date { static now(){return now;} }
  const cache=load('mobile/lib/query-memory-cache.ts',{}, {Date:Clock});
  const api=load('mobile/lib/api-client.ts',{
    '@react-native-async-storage/async-storage':{default:{getItem:async k=>storage.get(k)??null,setItem:async(k,v)=>storage.set(k,v),getAllKeys:async()=>[...storage.keys()],multiRemove:async keys=>keys.forEach(k=>storage.delete(k))}},
    'expo-constants':{default:{}},
    '../../packages/contracts/src/mobile-v1':{mobileApiAuthForRequest:(_method,path)=>path.includes('/private')?'optional':'public'},
    '@/lib/secure-storage':{getInstallationId:async()=>'isolated-test-installation'},
    '@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:null},error:null})}}},
    '@/lib/query-memory-cache':cache,
  },{Date:Clock,fetch:async(url,options)=>{requests++;calls.push(url);if(url.includes('/slow'))return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{aborts++;const e=new Error('Aborted');e.name='AbortError';reject(e);},{once:true}));return new Response(JSON.stringify({data:{value:requests}}),{status:200});}});
  return {api,get requests(){return requests;},get aborts(){return aborts;},calls,advance(ms){now+=ms;}};
}

test('public query TTL, forced refresh, private scope and concurrent request sharing',async()=>{
 const r=apiRuntime(),a=r.api;
 const [x,y]=await Promise.all([a.fetchMobileQuery('/public','/public',true,false),a.fetchMobileQuery('/public','/public',true,false)]);
 assert.equal(r.requests,1);assert.equal(x,y);
 await a.fetchMobileQuery('/public','/public',true,false,{staleTimeMs:30000});assert.equal(r.requests,1);
 await a.fetchMobileQuery('/public','/public',true,true,{staleTimeMs:30000});assert.equal(r.requests,2);
 r.advance(30001);await a.fetchMobileQuery('/public','/public',true,false,{staleTimeMs:30000});assert.equal(r.requests,3);
 await a.fetchMobileQuery('/private','/private#viewer=A','memory',false,{staleTimeMs:30000});
 await a.fetchMobileQuery('/private','/private#viewer=A','memory',false,{staleTimeMs:30000});assert.equal(r.requests,5);
 await Promise.all([a.fetchMobileQuery('/private','/private#viewer=A',false,true),a.fetchMobileQuery('/private','/private#viewer=B',false,true)]);assert.equal(r.requests,7);
});

test('screen focus honors TTL; pull refresh and invalidation remain fresh',async()=>{
 const r=apiRuntime(),render=renderer();let focused=true;const appListeners=new Set();
 const intent=load('mobile/lib/query-refresh-intent.ts');
 const hook=load('mobile/hooks/use-cached-query.ts',{react:render.hooks,'@react-navigation/native':{useIsFocused:()=>focused},'react-native':{AppState:{currentState:'active',addEventListener:(_name,fn)=>{appListeners.add(fn);return{remove:()=>appListeners.delete(fn)};}}},'@/lib/api-client':r.api,'@/lib/query-refresh-intent':intent});
 const h=render.mount(()=>hook.useCachedQuery('/public',{refreshOnFocus:true,staleTimeMs:30000}));
 appListeners.forEach(fn=>fn('background'));appListeners.forEach(fn=>fn('active'));h.render();
 await tick();h.render();assert.equal(r.requests,1);assert.ok(h.output.data);
 focused=false;h.render();focused=true;h.render();await tick();h.render();assert.equal(r.requests,1);
 h.output.revalidate();h.render();await tick();h.render();assert.equal(r.requests,1);
 h.output.refresh();h.render();await tick();h.render();assert.equal(r.requests,2);
 await r.api.invalidateApiCache('/public');h.render();await tick();h.render();assert.equal(r.requests,3);
 focused=false;h.render();r.advance(30001);focused=true;h.render();await tick();h.render();assert.equal(r.requests,4);
 h.unmount();
});

test('unused cancellable query aborts only after its final subscriber leaves',async()=>{
 const r=apiRuntime(),a=new AbortController(),b=new AbortController();
 const one=r.api.fetchMobileQuery('/slow','/slow','memory',false,{signal:a.signal,cancelOnUnused:true}).catch(e=>e.name);
 const two=r.api.fetchMobileQuery('/slow','/slow','memory',false,{signal:b.signal,cancelOnUnused:true}).catch(e=>e.name);
 await tick();assert.equal(r.requests,1);a.abort();assert.equal(r.aborts,0);b.abort();await Promise.all([one,two]);assert.equal(r.aborts,1);
});

test('home and news list share cancellable metadata requests and TTL',async()=>{
 const r=apiRuntime();const m=load('mobile/lib/news-metadata.ts',{'@/lib/api-client':r.api});
 const a=new AbortController(),b=new AbortController();
 await Promise.all([m.resolveNewsMetadata('thumbnail','https://news.example/article',a.signal),m.resolveNewsMetadata('thumbnail','https://news.example/article',b.signal)]);assert.equal(r.requests,1);
 await m.resolveNewsMetadata('thumbnail','https://news.example/article',b.signal);assert.equal(r.requests,1);
 await m.resolveNewsMetadata('title','https://news.example/article',b.signal);assert.equal(r.requests,2);
 r.advance(60001);await m.resolveNewsMetadata('thumbnail','https://news.example/article',b.signal);assert.equal(r.requests,3);
});

test('viewport notifications are event-driven, batched, and cancel when unused',()=>{
 let seq=0;const timers=new Map();const mod=load('mobile/lib/ad-viewport.ts',{}, {setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id)});let count=0;
 const off=mod.subscribeAdViewport(()=>count++);for(let i=0;i<100;i++)mod.notifyAdViewportChanged();assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,100);
 const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();assert.equal(count,1);assert.equal(timers.size,0);
 mod.notifyAdViewportChanged();off();assert.equal(timers.size,0);mod.notifyAdViewportChanged();assert.equal(timers.size,0);
});

test('banner defers offscreen SDK work, survives scrolling, releases on blur/background',()=>{
 const r=renderer();let focused=true,keyboard=false,y=2000,initializations=0,state={ready:true,revision:1};let onAppState;
 const listeners=new Set();
 const viewport={subscribeAdViewport:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},notifyAdViewportChanged:()=>listeners.forEach(fn=>fn())};
 const sdk={BannerAd:'Ad',BannerAdSize:{LARGE_BANNER:'LARGE'},TestIds:{BANNER:'test'}};
 const c=load('mobile/components/ads/content-banner.tsx',{
  react:r.hooks,'react/jsx-runtime':{jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})},
  'react-native':{AppState:{currentState:'active',addEventListener:(_name,fn)=>{onAppState=fn;return{remove(){}};}},useWindowDimensions:()=>({height:844,width:390}),StyleSheet:{create:x=>x},View:'View',Text:'Text'},
  '@react-navigation/native':{useIsFocused:()=>focused},'@/constants/mobile-ads':{ANDROID_BANNER_AD_UNIT_ID:'prod',MOBILE_ADS_TEST_MODE:true},'@/hooks/use-keyboard-layout':{useKeyboardLayout:()=>({keyboardVisible:keyboard})},'@/hooks/use-minion-theme':{useMinionTheme:()=>({fonts:{regular:{}},theme:{}})},'@/lib/ad-banner-policy':{isBannerUnfilled:()=>false},'expo-router':{usePathname:()=>'/'},'@/lib/ad-content-url':{getAdContentUrl:()=>'https://minion.fan/'},'@/lib/ad-viewport':viewport,'@/lib/mobile-ads':{getMobileAdsSdk:()=>sdk,getMobileAdsState:()=>state,subscribeMobileAds(){},initializeMobileAds:async()=>{initializations++;}},
 });
 const h=r.mount(c.ContentBanner,{placement:'test'});h.output.props.ref.current={measureInWindow:fn=>fn(0,y,358,100)};
 h.output.props.onLayout({nativeEvent:{layout:{width:358}}});h.render();assert.equal(initializations,0);assert.equal(h.output.props.children.type.name,'BannerPlaceholder');
 y=900;viewport.notifyAdViewportChanged();h.render();assert.equal(initializations,1);assert.equal(h.output.props.children.type.name,'BannerSession');
 const key=h.output.props.children.key;y=-1000;viewport.notifyAdViewportChanged();h.render();assert.equal(h.output.props.children.key,key);assert.equal(listeners.size,0);
 keyboard=true;h.render();assert.equal(h.output.props.children.type.name,'BannerSession');assert.equal(h.output.props.children.props.active,false);keyboard=false;
 focused=false;h.render();assert.equal(h.output.props.children.type.name,'BannerPlaceholder');assert.equal(listeners.size,0);
 y=2000;focused=true;h.render();assert.equal(h.output.props.children.type.name,'BannerPlaceholder');y=600;viewport.notifyAdViewportChanged();h.render();assert.equal(h.output.props.children.type.name,'BannerSession');
 onAppState('background');h.render();assert.equal(h.output.props.children.type.name,'BannerPlaceholder');state={ready:false,revision:2};h.render();h.unmount();assert.equal(listeners.size,0);
});

test('first-load failure removes the slot without JS retries; refresh failures keep a loaded banner',()=>{
 const r=renderer(), failures=[], heights=[];
 let timers=0,unfilled=0;
 const c=load('mobile/components/ads/content-banner.tsx',{
  react:r.hooks,'react/jsx-runtime':{jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})},
  'react-native':{StyleSheet:{create:x=>x},View:'View',Text:'Text'},
  '@react-navigation/native':{},'expo-router':{},'@/constants/mobile-ads':{getAndroidBannerAdUnitId:()=> 'prod',MOBILE_ADS_TEST_MODE:false},
  '@/hooks/use-keyboard-layout':{},'@/hooks/use-minion-theme':{},'@/lib/ad-content-url':{},'@/lib/ad-viewport':{},'@/lib/mobile-ads':{},
  '@/lib/ad-banner-policy':{bannerRequestDelay:()=>0,recordBannerRequest(){},recordBannerLoaded(){},recordBannerFailure:(...args)=>{failures.push(args);return 'googleMobileAds/error-code-no-fill';}},
 },{setTimeout:()=>{timers++;return timers;},console:{info(){}}},'\nexport { BannerSession };');
 const props={active:true,ads:{BannerAd:'Ad',BannerAdSize:{ANCHORED_ADAPTIVE_BANNER:'ADAPTIVE'},TestIds:{BANNER:'test'}},placement:'home-top',width:379,reservedHeight:100,onHeightChange:h=>heights.push(h),onUnfilled:()=>unfilled++};
 const fail=h=>{h.output.props.children[0].props.onAdFailedToLoad(Object.assign(new Error('No fill'),{code:'googleMobileAds/error-code-no-fill'}));h.render();};
 const first=r.mount(c.BannerSession,{...props,contentUrl:'https://minion.fan/players/faker'});
 const options=first.output.props.children[0].props.requestOptions;
 assert.deepEqual({...options},{requestNonPersonalizedAdsOnly:true,contentUrl:'https://minion.fan/players/faker'});
 first.render({...props,contentUrl:'https://minion.fan/schedule'});assert.equal(first.output.props.children[0].props.requestOptions,options);
 fail(first);assert.equal(unfilled,1);assert.equal(failures[0][2],true);assert.equal(timers,0);first.unmount();
 const h=r.mount(c.BannerSession,props);
 assert.deepEqual({...h.output.props.children[0].props.requestOptions},{requestNonPersonalizedAdsOnly:true});
 h.output.props.children[0].props.onAdLoaded({width:378.67,height:58.67});h.render();
 assert.equal(h.output.props.children[1],null);assert.equal(heights.at(-1),59);
 fail(h);assert.equal(unfilled,1);assert.equal(failures[1][2],false);assert.equal(h.output.props.children[1],null);assert.equal(h.output.props.style[1].height,59);
 h.render({...props,active:false});h.render(props);assert.equal(timers,0);assert.equal(h.output.props.children[0].type,'Ad');
 h.unmount();
});

test('a placement that fails its first load leaves no space until a later visit after cooldown',()=>{
 const r=renderer(), listeners=new Set();let now=1000,focused=true;
 class Clock extends Date {static now(){return now;}}
 const policy=load('mobile/lib/ad-banner-policy.ts',{}, {Date:Clock,console:{warn(){}}});
 const c=load('mobile/components/ads/content-banner.tsx',{
  react:r.hooks,'react/jsx-runtime':{jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})},
  'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},useWindowDimensions:()=>({height:844,width:390}),StyleSheet:{create:x=>x},View:'View',Text:'Text'},
  '@react-navigation/native':{useIsFocused:()=>focused},'expo-router':{usePathname:()=>'/players/faker'},
  '@/constants/mobile-ads':{getAndroidBannerAdUnitId:()=> 'prod',MOBILE_ADS_TEST_MODE:false},
  '@/hooks/use-keyboard-layout':{useKeyboardLayout:()=>({keyboardVisible:false})},'@/hooks/use-minion-theme':{},
  '@/lib/ad-banner-policy':policy,'@/lib/ad-content-url':load('mobile/lib/ad-content-url.ts'),
  '@/lib/ad-viewport':{subscribeAdViewport:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},notifyAdViewportChanged:()=>listeners.forEach(fn=>fn())},
  '@/lib/mobile-ads':{getMobileAdsSdk:()=>({}),getMobileAdsState:()=>({ready:true,revision:1,retryAt:null}),subscribeMobileAds(){},initializeMobileAds:async()=>{}},
 },{Date:Clock});
 const h=r.mount(c.ContentBanner,{placement:'player-detail-1'});h.output.props.ref.current={measureInWindow:fn=>fn(0,600,358,100)};
 h.output.props.onLayout({nativeEvent:{layout:{width:358}}});h.render();
 const session=h.output.props.children;assert.equal(session.type.name,'BannerSession');assert.equal(session.props.contentUrl,'https://minion.fan/players/faker');
 policy.recordBannerFailure('player-detail-1',Object.assign(new Error('No fill'),{code:'googleMobileAds/error-code-no-fill'}),true);session.props.onUnfilled();h.render();
 assert.equal(h.output,null);assert.equal(listeners.size,0);
 focused=false;h.render();now+=30000;focused=true;h.render();assert.equal(h.output,null);
 focused=false;h.render();now+=30000;focused=true;h.render();assert.equal(h.output.type,'View');assert.equal(h.output.props.children.type.name,'BannerSession');
 policy.recordBannerLoaded('player-detail-1');assert.equal(policy.isBannerUnfilled('player-detail-1'),false);
 h.unmount();
});

test('ad content URLs map only to public web pages with the same content',()=>{
 const {getAdContentUrl}=load('mobile/lib/ad-content-url.ts');
 assert.equal(getAdContentUrl('/'),'https://minion.fan/');
 assert.equal(getAdContentUrl('/players/페이커'),'https://minion.fan/players/%ED%8E%98%EC%9D%B4%EC%BB%A4');
 assert.equal(getAdContentUrl('/players/%ED%8E%98%EC%9D%B4%EC%BB%A4'),'https://minion.fan/players/%ED%8E%98%EC%9D%B4%EC%BB%A4');
 assert.equal(getAdContentUrl('/fan/t1/schedule'),'https://minion.fan/fan/t1/matches');
 assert.equal(getAdContentUrl('/fan/t1/community/free'),'https://minion.fan/fan/t1/community/free');
 assert.equal(getAdContentUrl('/community/post/9'),'https://minion.fan/community/post/9');
 for (const path of ['/me','/support','/community/new','/fan/t1/community/new','/players/'+'x'.repeat(600)]) assert.equal(getAdContentUrl(path),undefined);
});

test('home inventory uses three distinct production units and other screens retain their unit',()=>{
 const ads=load('mobile/constants/mobile-ads.ts',{}, {__DEV__:false});
 const ids=['home-top','home-teams','home-insights'].map(ads.getAndroidBannerAdUnitId);
 assert.equal(new Set(ids).size,3);
 assert.ok(ids.every(id=>/^ca-app-pub-7060554754100656\/\d{10}$/.test(id)));
 assert.ok(ids.every(id=>id!==ads.ANDROID_BANNER_AD_UNIT_ID));
 assert.equal(ads.getAndroidBannerAdUnitId('schedule-bottom'),ads.ANDROID_BANNER_AD_UNIT_ID);
 assert.equal(ads.MOBILE_ADS_TEST_MODE,false);
});

test('quick page re-entry waits for the previous request and cancels its timer while inactive',()=>{
 const r=renderer(), timers=new Map();let now=1000,seq=0,requests=0;
 class Clock extends Date {static now(){return now;}}
 const policy=load('mobile/lib/ad-banner-policy.ts',{}, {Date:Clock});
 const c=load('mobile/components/ads/content-banner.tsx',{
  react:r.hooks,'react/jsx-runtime':{jsx:(type,props,key)=>({type,props,key}),jsxs:(type,props,key)=>({type,props,key})},
  'react-native':{StyleSheet:{create:x=>x},View:'View',Text:'Text'},'@react-navigation/native':{},'expo-router':{},
  '@/constants/mobile-ads':{getAndroidBannerAdUnitId:()=> 'prod',MOBILE_ADS_TEST_MODE:false},
  '@/hooks/use-keyboard-layout':{},'@/hooks/use-minion-theme':{},'@/lib/ad-content-url':{},'@/lib/ad-viewport':{},'@/lib/mobile-ads':{},
  '@/lib/ad-banner-policy':{...policy,recordBannerRequest:p=>{requests++;policy.recordBannerRequest(p);}},
 },{Date:Clock,console:{info(){}},setTimeout:(fn,delay)=>{timers.set(++seq,{fn,delay});return seq;},clearTimeout:id=>timers.delete(id)},'\nexport { BannerSession };');
 const props={active:true,ads:{BannerAd:'Ad',BannerAdSize:{ANCHORED_ADAPTIVE_BANNER:'ADAPTIVE'},TestIds:{BANNER:'test'}},placement:'home-top',width:379,reservedHeight:100,onHeightChange(){},onUnfilled(){}};
 const first=r.mount(c.BannerSession,props);assert.equal(requests,1);first.unmount();
 now+=10000;
 const second=r.mount(c.BannerSession,props);assert.equal(second.output.type.name,'BannerPlaceholder');assert.equal(requests,1);
 assert.equal([...timers.values()][0].delay,50000);
 second.render({...props,active:false});assert.equal(timers.size,0);
 now+=30000;second.render(props);assert.equal([...timers.values()][0].delay,20000);
 now+=20000;[...timers.values()][0].fn();second.render();assert.equal(requests,2);assert.equal(timers.size,0);
 assert.equal(second.output.props.children[0].type,'Ad');second.unmount();
});

function callbackSource(file,name){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name)node=n;ts.forEachChild(n,visit);}visit(source);assert.ok(node);return node.initializer.arguments[0].getText(source);}
test('account auto refresh shares work; explicit refresh supersedes it; identity changes reject stale results',async()=>{
 const source=callbackSource('mobile/providers/auth-provider.tsx','refreshViewer');
 const cacheUserId={current:'A'},viewerRevision={current:0},viewerRequest={current:null},pending=[],viewers=[];
 const fn=vm.runInNewContext(ts.transpileModule('globalThis.callback = '+source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\ncallback',{cacheUserId,viewerRevision,viewerRequest,Promise,setViewer:x=>viewers.push(x.id),fetchMobileQuery:()=>new Promise(resolve=>pending.push(resolve)),readViewerFromSupabase:async()=>null});
 const first=fn(true),same=fn(true);assert.equal(first,same);assert.equal(pending.length,1);
 const forced=fn();assert.notEqual(forced,first);assert.equal(pending.length,2);
 pending[0]({viewer:{id:'A'}});await first;assert.equal(viewers.length,0);pending[1]({viewer:{id:'A'}});await forced;assert.deepEqual(viewers,['A']);
 const old=fn(true);cacheUserId.current='B';viewerRevision.current++;const next=fn(true);pending[2]({viewer:{id:'A'}});pending[3]({viewer:{id:'B'}});await Promise.all([old,next]);assert.deepEqual(viewers,['A','B']);
});

test('live polling shares one channel, stops timers in background and releases final subscriber',async()=>{
 const callbacks=new Set(),timers=new Map();let seq=0,resolve,calls=0;
 const app={currentState:'active',addEventListener:(_name,fn)=>{callbacks.add(fn);return{remove:()=>callbacks.delete(fn)};}};
 const m=load('mobile/lib/live-match-polling.ts',{'react-native':{AppState:app},'@/lib/api-client':{fetchMobileQuery:()=>{calls++;return new Promise(r=>resolve=r);}}},{setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id)});
 const a=m.subscribeLiveMatch('match'),b=m.subscribeLiveMatch('match');assert.equal(calls,1);resolve({});await tick();assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,10000);
 app.currentState='background';callbacks.forEach(fn=>fn('background'));assert.equal(timers.size,0);a.unsubscribe();assert.equal(callbacks.size,1);b.unsubscribe();assert.equal(callbacks.size,0);
});


test('same-query effect replacement reattaches before cancellation aborts the network', async()=>{
 const r=apiRuntime(), a=new AbortController(), b=new AbortController();
 const one=r.api.fetchMobileQuery('/slow','/slow','memory',false,{signal:a.signal,cancelOnUnused:true}).catch(e=>e.name);
 await tick();a.abort();const two=r.api.fetchMobileQuery('/slow','/slow','memory',false,{signal:b.signal,cancelOnUnused:true}).catch(e=>e.name);
 await tick();assert.equal(r.requests,1);assert.equal(r.aborts,0);b.abort();await Promise.all([one,two]);assert.equal(r.aborts,1);
});
test('an automatic revalidation cannot downgrade an explicit fresh request',()=>{
 const m=load('mobile/lib/query-refresh-intent.ts');const intent=m.createQueryRefreshIntent('/public');
 intent.request();intent.request(false);const pending=intent.start('/public');assert.equal(pending.fresh,true);pending.finish();
 intent.request(false);assert.equal(intent.start('/public').fresh,false);
});


test('schedule initial activation respects cache but its minute timer still forces fresh data',()=>{
 const file='mobile/app/(tabs)/schedule.tsx';const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;
 const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='syncDate')node=n;ts.forEachChild(n,visit)};visit(source);assert.ok(node);
 let automatic=0,forced=0,scheduled;
 const context={timer:undefined,Date,Math,AppState:{currentState:'active'},dateKeyKST:()=> '2026-10-31',observedDateRef:{current:'2026-10-31'},revalidate:()=>automatic++,revalidateCalendar:()=>automatic++,refresh:()=>forced++,refreshCalendar:()=>forced++,clearTimeout(){},setTimeout:fn=>{scheduled=fn;return 1;}};
 const fn=vm.runInNewContext(ts.transpileModule('globalThis.callback = '+node.initializer.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\ncallback',context);
 context.syncDate=fn;fn();assert.equal(automatic,2);assert.equal(forced,0);scheduled();assert.equal(forced,2);
 context.AppState.currentState='background';fn(true);assert.equal(forced,2);
});
