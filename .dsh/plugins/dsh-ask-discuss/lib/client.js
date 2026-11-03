/* dsh-ask-discuss: browser bundle, built by build.mjs */
(()=>{function _(u){let{React:t,copy:d,usePending:p,open:m}=u,b=t.createElement;return function(s){let e=p(s),a=typeof s?.sessionId=="string"?s.sessionId:void 0;return a===void 0||e===void 0||e.kind!=="question"?null:b("button",{type:"button",className:"dsad-entry",title:d.t("entry.title"),onClick:()=>m(a)},b("span",{className:"dsad-entry-dot"}),b("span",null,d.t("entry.label")))}}function N(u){let t=u?.useSessionPendingInteraction,d=u?.sessionId;if(!(typeof t!="function"||typeof d!="string"))return t(p=>p?.get(d))}var w="askDiscuss",R={"entry.label":"\u8BA8\u8BBA","entry.title":"\u548C Harness \u8BA8\u8BBA\u8FD9\u9053\u9898\uFF08\u8BA8\u8BBA\u4E0D\u4F1A\u8FDB\u5165\u4E3B\u4E0A\u4E0B\u6587\uFF09","tab.title":"\u8BA8\u8BBA","panel.background":"\u8BA8\u8BBA\u80CC\u666F\uFF08\u53EA\u5BF9\u8FD9\u4E2A\u7A97\u53E3\u53EF\u89C1\uFF09","panel.empty":"\u628A\u4F60\u7684\u7591\u95EE\u8BF4\u6E05\u695A\uFF0C\u8BA8\u8BBA\u4F19\u4F34\u5E26\u7740\u8FD9\u9053\u9898\u548C\u6700\u8FD1\u7684\u5BF9\u8BDD\u56DE\u7B54\u4F60\u3002","panel.placeholder":"\u95EE\u70B9\u4EC0\u4E48\u2026\u2026\uFF08Enter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C\uFF09","panel.send":"\u53D1\u9001","panel.sending":"\u53D1\u9001\u4E2D\u2026","panel.thinking":"\u6B63\u5728\u56DE\u7B54\u2026","panel.loading":"\u6B63\u5728\u51C6\u5907\u8BA8\u8BBA\u2026","panel.tool":"\u5DE5\u5177","panel.failed":"\u5931\u8D25","reason.no-pending":"\u8FD9\u9053\u9898\u521A\u521A\u5DF2\u7ECF\u88AB\u56DE\u7B54\uFF0C\u6216\u8005\u5DF2\u7ECF\u53D6\u6D88\u4E86\u3002","reason.plan-review":"\u8BA1\u5212\u5BA1\u6279\u5361\u4E0D\u63A5\u8BA8\u8BBA\uFF0C\u8BF7\u76F4\u63A5\u5728\u5361\u7247\u4E0A\u6279\u51C6\u6216\u62D2\u7EDD\u3002","reason.parent-unavailable":"\u4E3B\u4F1A\u8BDD\u5DF2\u7ECF\u4E0D\u5728\u8FD0\u884C\uFF0C\u8BA8\u8BBA\u5F00\u4E0D\u8D77\u6765\u3002","reason.stale":"\u95EE\u9898\u5DF2\u7ECF\u6362\u4E86\u4E00\u9053\uFF0C\u5173\u6389\u8FD9\u4E2A\u7A97\u53E3\u91CD\u65B0\u6253\u5F00\u8BA8\u8BBA\u3002","reason.empty-text":"\u5148\u8BF4\u70B9\u4EC0\u4E48\u518D\u53D1\u9001\u3002","reason.text-too-long":"\u8FD9\u6BB5\u592A\u957F\u4E86\uFF0C\u5206\u51E0\u8F6E\u8BF4\u5427\u3002","reason.unreachable":"\u8FDE\u4E0D\u4E0A\u5BBF\u4E3B\uFF1A\u63D2\u4EF6\u53EF\u80FD\u6CA1\u6709\u6302\u8F7D\uFF0C\u6216\u8005\u5DF2\u7ECF\u5378\u8F7D\u3002","reason.create-failed":"\u8BA8\u8BBA\u5B50\u4EE3\u7406\u8D77\u4E0D\u6765\uFF1A{message}","reason.send-failed":"\u6D88\u606F\u6CA1\u9001\u5230\u8BA8\u8BBA\u4F19\u4F34\uFF1A{message}","reason.internal":"\u5BBF\u4E3B\u5185\u90E8\u9519\u8BEF\uFF1A{message}","reason.unknown":"\u51FA\u4E86\u70B9\u95EE\u9898\uFF1A{reason}"},E={"entry.label":"Discuss","entry.title":"Talk this question over with the Harness (the discussion stays out of the main context)","tab.title":"Discussion","panel.background":"Discussion background (visible only in this panel)","panel.empty":"Say what you are unsure about; the partner answers with this question and the recent conversation in hand.","panel.placeholder":"Ask something\u2026 (Enter sends, Shift+Enter breaks a line)","panel.send":"Send","panel.sending":"Sending\u2026","panel.thinking":"Answering\u2026","panel.loading":"Preparing the discussion\u2026","panel.tool":"tool","panel.failed":"failed","reason.no-pending":"This question has already been answered or cancelled.","reason.plan-review":"Plan reviews stay on the native card; approve or refuse it there.","reason.parent-unavailable":"The main Session is no longer running, so the discussion cannot start.","reason.stale":"The question changed; close this panel and open the discussion again.","reason.empty-text":"Type something before sending.","reason.text-too-long":"That is too long for one message; split it up.","reason.unreachable":"Cannot reach the Host: the plugin is probably not mounted or already unloaded.","reason.create-failed":"The discussion subagent could not start: {message}","reason.send-failed":"The message did not reach the discussion partner: {message}","reason.internal":"Host error: {message}","reason.unknown":"Something went wrong: {reason}"};function j(u){let{React:t,copy:d,transport:p,MarkdownText:m,usePending:b}=u,i=t.createElement;function s(e,a){let n=e?.seq??a;if(e?.role==="user")return i("div",{key:n,className:"dsad-bubble dsad-user"},e.text);if(e?.role==="tool"){let l=`${d.t("panel.tool")} ${e.name??""}${e.error===!0?` \xB7 ${d.t("panel.failed")}`:""}`.trim();return i("div",{key:n,className:"dsad-tool"},i("div",null,l),typeof e.text=="string"&&e.text!==""?i("pre",null,e.text):null)}let g=typeof e?.text=="string"?e.text:"";return i("div",{key:n,className:"dsad-bubble dsad-assistant"},m!==void 0&&g!==""?i(m,{text:g}):i("div",{style:{whiteSpace:"pre-wrap"}},g))}return function(a){let n=typeof a?.sessionId=="string"?a.sessionId:void 0,g=typeof a?.tabInfo=="function"?a.tabInfo():void 0,l=b(a),[c,f]=t.useState({phase:"loading",pack:"",messages:[],running:!1,childId:void 0,error:void 0}),[x,v]=t.useState(""),[y,C]=t.useState(!1),S=t.useRef(void 0),T=t.useRef(!0),$=t.useRef(!1),D=t.useRef(!1),A=t.useRef(void 0);t.useEffect(()=>{T.current=!0;let o=!1;return n===void 0?(f({phase:"error",pack:"",messages:[],running:!1,childId:void 0,error:{reason:"unreachable"}}),()=>{o=!0}):(p.open({sessionId:n}).then(r=>{if(!o){if(r.ok!==!0){f({phase:"error",pack:"",messages:[],running:!1,childId:void 0,error:r});return}S.current=r.token,f({phase:"ready",pack:typeof r.pack=="string"?r.pack:"",messages:Array.isArray(r.messages)?r.messages:[],running:r.running===!0,childId:r.childId,error:void 0})}}),()=>{o=!0,T.current=!1})},[n]),t.useEffect(()=>{if(c.phase!=="ready"||n===void 0||c.childId===void 0)return;let o=setInterval(()=>{p.transcript({sessionId:n,token:S.current}).then(r=>{if(T.current){if(r.ok!==!0){if(r.reason==="no-pending"||r.reason==="stale")return;f(h=>({...h,error:r}));return}f(h=>({...h,messages:Array.isArray(r.messages)?r.messages:h.messages,running:r.running===!0,childId:r.childId??h.childId,error:void 0}))}})},700);return()=>clearInterval(o)},[n,c.phase,c.childId]),t.useEffect(()=>{if(l!==void 0){$.current=!0;return}!$.current||D.current||(D.current=!0,g?.tab?.actions?.close?.())},[l]),t.useEffect(()=>{let o=A.current;o!=null&&(o.scrollTop=o.scrollHeight)},[c.messages.length,c.running]);let P=t.useCallback(()=>{let o=x.trim();o===""||y||n===void 0||(C(!0),p.send({sessionId:n,token:S.current,text:o}).then(r=>{if(T.current){if(C(!1),r.ok!==!0){f(h=>({...h,error:r}));return}S.current=r.token,v(""),f(h=>({...h,error:void 0,running:r.running===!0,childId:r.childId??h.childId}))}}))},[x,y,n]),M=t.useCallback(o=>{o.key!=="Enter"||o.shiftKey||o.nativeEvent!==void 0&&o.nativeEvent.isComposing===!0||(o.preventDefault(),P())},[P]),k=[];c.pack!==""&&k.push(i("details",{key:"pack",className:"dsad-pack"},i("summary",null,d.t("panel.background")),i("pre",null,c.pack))),c.phase==="loading"&&k.push(i("div",{key:"loading",className:"dsad-hint"},d.t("panel.loading"))),c.phase==="ready"&&c.messages.length===0&&k.push(i("div",{key:"empty",className:"dsad-hint"},d.t("panel.empty")));for(let[o,r]of c.messages.entries())k.push(s(r,o));return c.running&&k.push(i("div",{key:"running",className:"dsad-running"},d.t("panel.thinking"))),c.error!==void 0&&k.push(i("div",{key:"error",className:"dsad-error"},d.reason(c.error))),i("div",{className:"dsad-panel"},i("div",{className:"dsad-scroll",ref:A},k),i("div",{className:"dsad-compose"},i("textarea",{className:"dsad-input",value:x,placeholder:d.t("panel.placeholder"),onChange:o=>v(o.target.value),onKeyDown:M}),i("div",{className:"dsad-actions"},i("button",{type:"button",className:"dsad-send",disabled:y||x.trim()==="",onClick:P},y?d.t("panel.sending"):d.t("panel.send")))))}}var L="dsh-ask-discuss/styles",O=`
.dsad-entry {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 28px;
	padding: 0 10px;
	border: 1px solid rgba(127,127,127,0.35);
	border-radius: 8px;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 12px;
	line-height: 1;
	cursor: pointer;
}

.dsad-entry:hover {
	background: rgba(127,127,127,0.14);
}

.dsad-entry-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #4c9aff;
}

.dsad-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	color: inherit;
	font: inherit;
}

.dsad-scroll {
	flex: 1 1 auto;
	min-height: 0;
	overflow: auto;
	padding: 12px 14px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.dsad-pack {
	border: 1px solid rgba(127,127,127,0.25);
	border-radius: 8px;
	padding: 8px 10px;
	background: rgba(127,127,127,0.06);
	font-size: 12px;
}

.dsad-pack summary {
	cursor: pointer;
	opacity: 0.75;
	user-select: none;
}

.dsad-pack pre {
	margin: 8px 0 0;
	white-space: pre-wrap;
	word-break: break-word;
	font-family: inherit;
	font-size: 12px;
	opacity: 0.85;
	max-height: 260px;
	overflow: auto;
}

.dsad-bubble {
	max-width: 100%;
	border-radius: 10px;
	padding: 8px 11px;
	font-size: 13px;
	line-height: 1.6;
	overflow-wrap: anywhere;
}

.dsad-user {
	align-self: flex-end;
	background: rgba(76,154,255,0.16);
	max-width: 86%;
}

.dsad-assistant {
	align-self: flex-start;
	background: rgba(127,127,127,0.10);
	max-width: 96%;
}

.dsad-tool {
	align-self: flex-start;
	max-width: 96%;
	font-size: 12px;
	opacity: 0.7;
	border-left: 2px solid rgba(127,127,127,0.35);
	padding-left: 8px;
}

.dsad-tool pre {
	margin: 4px 0 0;
	white-space: pre-wrap;
	word-break: break-word;
	font-family: inherit;
	max-height: 140px;
	overflow: auto;
}

.dsad-running {
	font-size: 12px;
	opacity: 0.6;
	padding-left: 2px;
}

.dsad-error {
	border: 1px solid rgba(220,90,90,0.55);
	background: rgba(220,90,90,0.10);
	color: inherit;
	border-radius: 8px;
	padding: 8px 10px;
	font-size: 12px;
	line-height: 1.5;
}

.dsad-hint {
	font-size: 12px;
	opacity: 0.6;
	padding: 4px 2px;
}

.dsad-compose {
	flex: 0 0 auto;
	border-top: 1px solid rgba(127,127,127,0.25);
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.dsad-input {
	width: 100%;
	box-sizing: border-box;
	min-height: 60px;
	max-height: 160px;
	resize: vertical;
	border-radius: 8px;
	border: 1px solid rgba(127,127,127,0.35);
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 13px;
	line-height: 1.5;
	padding: 8px 10px;
}

.dsad-input:focus {
	outline: none;
	border-color: rgba(76,154,255,0.7);
}

.dsad-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}

.dsad-send {
	height: 30px;
	padding: 0 16px;
	border-radius: 8px;
	border: 1px solid rgba(76,154,255,0.6);
	background: rgba(76,154,255,0.18);
	color: inherit;
	font: inherit;
	font-size: 13px;
	cursor: pointer;
}

.dsad-send:disabled {
	opacity: 0.45;
	cursor: default;
}
`;function q(u=document){if(u.getElementById(L)!==null)return()=>{};let t=u.createElement("style");return t.id=L,t.dataset.plugin="dsh-ask-discuss",t.textContent=O,u.head.appendChild(t),()=>{t.remove()}}var G="/api/ask-discuss";function H(u={}){let t=u.fetchImpl??((...e)=>fetch(...e)),d=u.prefix??G;async function p(e,a){try{let n=await t(`${d}${e}`,a);if(!n.ok)return{ok:!1,reason:"unreachable",message:`HTTP ${n.status}`};let g=await n.json();return g===null||typeof g!="object"?{ok:!1,reason:"internal",message:"malformed payload"}:g}catch(n){return{ok:!1,reason:"unreachable",message:String(n?.message??n)}}}function m(e){return p(`/state?sessionId=${encodeURIComponent(e)}`,{method:"GET"})}function b(e){return p("/open",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:e.sessionId,token:e.token})})}function i(e){return p("/send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:e.sessionId,token:e.token,text:e.text})})}function s(e){let a=[`sessionId=${encodeURIComponent(e.sessionId)}`];return typeof e.token=="number"&&a.push(`token=${e.token}`),p(`/transcript?${a.join("&")}`,{method:"GET"})}return{state:m,open:b,send:i,transcript:s}}var I="dsh-ask-discuss",z="ask-discuss";window.__ModuleLoader__.load({id:I,factory:u=>{let t=u("react"),d;try{d=u("@deepseek-ai/dsh-client-ui-primitives").MarkdownText}catch{d=void 0}let p=H();function m(s){function e(){let l="";try{l=String(s.locale.getLocale()?.id??"")}catch{l=""}return l.toLowerCase().startsWith("zh")?R:E}let a;try{a=s.locale.bind(w)}catch{a=void 0}function n(l){if(typeof a=="function")try{let f=a(l);if(typeof f=="string"&&f!==""&&f!==l)return f}catch{}return e()[l]??E[l]??l}function g(l){let c=typeof l?.reason=="string"?l.reason:"unknown",f=`reason.${c}`,x=n(f),v=x===f?n("reason.unknown").replace("{reason}",c):x,y=typeof l?.message=="string"?l.message:"";return v.replace("{message}",y)}return{t:n,reason:g}}function b(s,e){try{s.sidebarRight.openTab(z,{params:{sessionId:e}})}catch(n){s.logger?.warn?.(`ask-discuss: cannot open the discussion tab: ${String(n?.message??n)}`);return}let a=()=>{try{let n=s.sidebarRight.active();return n==null||typeof n.kind=="string"&&n.kind!==z?!1:(s.sidebarRight.float(n.id),!0)}catch(n){return s.logger?.warn?.(`ask-discuss: cannot float the discussion tab: ${String(n?.message??n)}`),!1}};a()||setTimeout(a,0)}function i(s){s.effect(()=>q(),"ask-discuss: styles"),s.effect(()=>s.locale.register(w,{zh:R,en:E}),"ask-discuss: dictionaries");let e=m(s),a=_({React:t,copy:e,usePending:N,open:g=>b(s,g)}),n=j({React:t,copy:e,transport:p,MarkdownText:d,usePending:N});s.effect(()=>s.sidebarRightTabs.register({id:I,kind:z,priority:"extension",title:()=>e.t("tab.title")}),"ask-discuss: tab type"),s.slots.inject("sidebar.right.pane.tab",()=>s.slots.register({name:"sidebar.right.pane.tab",key:I,locale:w},n)),s.slots.inject("conversation.session.header.utilities",()=>s.slots.register({name:"conversation.session.header.utilities",id:I,order:40,locale:w},a))}return{name:I,inject:["locale","slots","sidebarRight","sidebarRightTabs"],apply:i}}});})();
