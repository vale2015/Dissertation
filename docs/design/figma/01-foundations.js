const page=await figma.getNodeByIdAsync('206:414');
await figma.setCurrentPageAsync(page);
if(page.children.length) return {alreadyPopulated:true,pageId:page.id,items:page.children.map(n=>({id:n.id,name:n.name,type:n.type}))};
const colors={Canvas:'#fafbfc',Surface:'#ffffff',Text:'#101828',Muted:'#667085',Brand:'#a7141c',Tint:'#fff1f2',Border:'#eceef1',Chart:'#db3347',Navy:'#394d78',Success:'#027a48',SuccessTint:'#ecfdf3',Error:'#b42318'};
const paint={}; for(const [name,value] of Object.entries(colors)) paint[name]=$fig.getStyle('RFS/'+name)||$fig.paintStyle({name:'RFS/'+name,paints:[figma.util.solidPaint(value)]});
const type={}; for(const [name,size,style] of [['Display',36,'Bold'],['Heading',22,'Semi Bold'],['Section',16,'Semi Bold'],['Body',14,'Regular'],['Label',13,'Semi Bold'],['Small',12,'Regular'],['Caption',11,'Medium'],['Value',29,'Bold']]) type[name]=$fig.getStyle('RFS/'+name)||$fig.textStyle({name:'RFS/'+name,fontName:{family:'Inter',style},fontSize:size,lineHeight:{unit:'PERCENT',value:140}});
const T=(s,role='Body',color='Text',extra={})=>$fig.text({name:s.slice(0,48),characters:s,textStyle:type[role],fills:paint[color],...extra});
const box=(name,children,opts={})=>$fig.autoLayout({name,layoutMode:'VERTICAL',itemSpacing:12,fills:paint.Surface,...opts},children);
const components={};
const button=(variant,color,bg,stroke,opacity=1)=>$fig.component({name:'Style='+variant,layoutMode:'HORIZONTAL',width:158,height:44,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',paddingLeft:18,paddingRight:18,itemSpacing:8,counterAxisAlignItems:'CENTER',primaryAxisAlignItems:'CENTER',cornerRadius:9,fills:paint[bg],...(stroke?{strokes:paint[stroke],strokeWeight:1}:{}),opacity},[T('Continue','Label',color).textProp('Label')]);
components.Button=$fig.variants({name:'RFS/Button',x:0,y:500},[button('Primary','Surface','Brand'),button('Secondary','Text','Surface','Border'),button('Disabled','Surface','Brand',null,0.5)]);
components.Field=$fig.component({name:'RFS/Field',x:0,y:1000,layoutMode:'VERTICAL',width:320,layoutSizingHorizontal:'FIXED',itemSpacing:8},[
T('Field label','Label').textProp('Label'),
box('Input',[T('Enter a value','Body','Muted').textProp('Value')],{width:320,height:46,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',paddingLeft:13,paddingRight:13,primaryAxisAlignItems:'CENTER',cornerRadius:9,strokes:paint.Border,strokeWeight:1}),
T('Supporting text','Small','Muted').textProp('Hint').booleanProp('Show hint')]);
components.KPI=$fig.component({name:'RFS/KPI card',x:400,y:1000,layoutMode:'VERTICAL',width:262,height:140,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',itemSpacing:5,paddingLeft:20,paddingRight:20,paddingTop:20,paddingBottom:20,fills:paint.Surface,strokes:paint.Border,strokeWeight:1,cornerRadius:12},[
T('Expected covers','Label').textProp('Title'),T('—','Value').textProp('Value'),T('Predicted total across the next 7 days.','Small','Muted',{width:222,textAutoResize:'HEIGHT'}).textProp('Description')]);
components.Heading=$fig.component({name:'RFS/Screen heading',x:750,y:1000,layoutMode:'VERTICAL',width:720,layoutSizingHorizontal:'FIXED',itemSpacing:5},[
T('Dashboard','Display').textProp('Title'),T("Here's your restaurant overview.",'Body','Muted',{width:720,textAutoResize:'HEIGHT'}).textProp('Subtitle')]);
const nav=(state,bg,fg)=>$fig.component({name:'State='+state,layoutMode:'HORIZONTAL',width:220,height:44,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',paddingLeft:15,paddingRight:15,itemSpacing:15,counterAxisAlignItems:'CENTER',cornerRadius:9,fills:paint[bg]},[T('Dashboard','Body',fg).textProp('Label')]);
components.Nav=$fig.variants({name:'RFS/Navigation item',x:650,y:500},[nav('Default','Surface','Text'),nav('Active','Brand','Surface'),nav('Hover','Tint','Brand')]);
components.Row=$fig.component({name:'RFS/Table row',x:0,y:1250,layoutMode:'HORIZONTAL',width:1050,height:48,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',paddingLeft:16,paddingRight:16,itemSpacing:10,counterAxisAlignItems:'CENTER',fills:paint.Surface,strokes:paint.Border,strokeWeight:1},Array.from({length:5},(_,i)=>T('Column '+(i+1),'Body','Text',{width:i===0?230:185,textAutoResize:'HEIGHT'}).textProp('Cell'+(i+1))));
components.Message=$fig.component({name:'RFS/Chat message',x:1150,y:500,layoutMode:'VERTICAL',width:352,layoutSizingHorizontal:'FIXED',itemSpacing:8,paddingLeft:14,paddingRight:14,paddingTop:14,paddingBottom:14,fills:paint.Surface,strokes:paint.Border,strokeWeight:1,cornerRadius:12},[T('RFS AI','Label','Brand').textProp('Sender'),T('How can I help you plan your next service?','Body','Text',{width:324,textAutoResize:'HEIGHT'}).textProp('Message')]);
const notices=[['Info','Tint','Brand'],['Error','Tint','Error'],['Success','SuccessTint','Success']].map(([state,bg,fg])=>$fig.component({name:'State='+state,layoutMode:'VERTICAL',width:600,layoutSizingHorizontal:'FIXED',paddingLeft:20,paddingRight:20,paddingTop:18,paddingBottom:18,itemSpacing:5,fills:paint[bg],cornerRadius:9},[T('No data available','Section',fg).textProp('Title'),T('Choose another date or retry.','Body',fg,{width:560,textAutoResize:'HEIGHT'}).textProp('Body')]));
components.Notice=$fig.variants({name:'RFS/Notice',x:0,y:1450},notices);
components.Calendar=$fig.component({name:'RFS/Date control',x:750,y:1250,layoutMode:'VERTICAL',width:220,layoutSizingHorizontal:'FIXED',itemSpacing:8,paddingTop:12,paddingBottom:12},[
T('View a day','Small','Muted'),box('Date selector',[T('25/11/2026','Label').textProp('Date')],{width:220,height:42,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',paddingLeft:12,paddingRight:12,primaryAxisAlignItems:'CENTER',cornerRadius:9,strokes:paint.Border,strokeWeight:1}),T('Show overview','Small','Brand')]);
const title=box('RFS foundations',[
T('RFS UI foundations','Display'),T('Reusable local components and shared styles','Heading','Muted'),
T('Source-led reference • 25 November 2026 • Inter typography','Body','Muted'),
T('Colors reflect rfs-redesign.css. The app uses inline CSS values here; these shared Figma paint styles do not claim a published token package or automatic code synchronization.','Small','Muted',{width:1120,textAutoResize:'HEIGHT'}),
$fig.autoLayout({name:'Palette',layoutMode:'HORIZONTAL',itemSpacing:16},Object.entries(colors).map(([n,c])=>box(n,[$fig.rectangle({name:n,width:64,height:42,fills:paint[n],cornerRadius:8}),T(n,'Caption'),T(c,'Caption','Muted')],{width:80})))
],{width:1200,paddingTop:32,paddingBottom:32,paddingLeft:32,paddingRight:32,cornerRadius:16});
title.set({x:0,y:0});
await $fig.done();
for(const key of ['Button','Nav','Notice']) {const set=components[key].node; const vs=set.children; const maxW=Math.max(...vs.map(v=>v.width)), maxH=Math.max(...vs.map(v=>v.height)); for(let i=0;i<vs.length;i++){ $fig.get(vs[i].id).set({x:24+i*(maxW+24),y:24}); } $fig.get(set.id).set({width:vs.length*(maxW+24)+24,height:maxH+48});}
await $fig.done();
return {pageId:page.id,componentIds:Object.fromEntries(Object.entries(components).map(([k,v])=>[k,v.node.id])),paintStyles:Object.fromEntries(Object.entries(paint).map(([k,v])=>[k,v.id])),textStyles:Object.fromEntries(Object.entries(type).map(([k,v])=>[k,v.id])),foundationId:title.node.id};

