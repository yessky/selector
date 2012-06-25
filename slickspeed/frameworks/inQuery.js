/******
 * CSS 3 Selector inQuery
 * http://code.google.com/p/inquery/
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 * $Author: achun (achun.shx at gmail.com)
 * $Create Date: 2008-10-30
 * $Revision: 2008-12-15
 ******/
var $=inQuery=inMixin(
function(expr,context,deep,withcontext){
	if(undefined==deep) deep=true;
	var ins = inQuery.initQuery(expr,context,deep,withcontext);
	return ins;
},inCore,{
	isinQuery:'8',
	Instance:{
		isinQuery:'8',
		find:function(expr){
			return inQuery(expr,this);
		}
	},
	inID:1,
	initQuery:function(expr,context,deep,withcontext){
		if(!expr)
			return [document];
		if(!context) context=[document];
		if(context.nodeType!==undefined) context=[context];
		if(typeof context=='string') context=inQuery.initQuery(context,[document],true,true);
		if (!context.length) return [];
		expr= expr.replace(/\s+/g,' ')
						.replace(/(~|\+|\*)([^0-9=])/g,' $1 $2')
						.replace(/ +/g,' ')
						.replace(/(,| |#|\.|>|:|\[|\]|[!~^|$*]=|~=|[^0-9]+n\+[^0-9 ]*|=|[+~]$)/g,'\n$1\n')
						.split(/\n/);
		for (var i=0; i<expr.length;)
			if (''===expr[i] )
				expr.splice(i,1);
			else i++;
		this.skipMark=false;
		for (var i=0; i<expr.length;){
			if (' '==expr[i] && ('* > + ~'.indexOf(expr[i+1])!=-1 || '* > + ~'.indexOf(expr[i-1])!=-1)){
				expr.splice(i,1);
				continue;
			}
			//if(this.skipMark) this.skipMark=',~'.indexOf(expr[i])==-1;
			i++;
		}
		var options={expr:expr,contextID:{},retID:{},at:0,deep:true,withcontext:false,
			root:context.slice(0),context:context,ret:[]};
		while(this.Query(options)) ;
		return options.ret;
	},
	addNodes:function(n,mark,ret){
		if (undefined===n.nodeType){
			if(this.skipMark)
				for (var i=0;i<n.length ;i++ ) ret.push(n[i]);
			else
			for (var i=0;i<n.length ;i++ ){
				if (n[i].inQueryID){
					if(mark[n[i].inQueryID]) continue;
				}else
					n[i].inQueryID=this.inID++;
				mark[n[i].inQueryID]=true;
				ret.push(n[i]);
			}
			return true;
		}else{
			if(this.skipMark){
				ret.push(n);
				return true;
			}
			if (n.inQueryID){
				if(mark[n.inQueryID]) return false;
			}else
				n.inQueryID=this.inID++;
			mark[n.inQueryID]=true;
			ret.push(n);
		}
		return true;
	},/*递归查询分派*/
	Query:function(options){
		if (options.expr[options.at-1]) options.withcontext=' '.indexOf(options.expr[options.at-1])==-1;
		var fn=options.expr[options.at++];
		if(!fn){
			this.addNodes(options.context,options.retID,options.ret);
			return false;
		}
		if ('&, *#.>+~[:'.indexOf(fn)===-1){
			var v=fn;
			fn='tagNameQuery';
		}else{
			var v=options.expr[options.at++];
		}
		options.contextID={};
		this[fn](v,options);
		return true;
	},
	tagNameQuery:function(v,options){//by tagName
		v=v.toUpperCase();
		if (options.withcontext){
			for (var i=0;i<options.context.length ;){
				if (options.context[i].tagName!=v)
					options.context.splice(i,1);
				else
					i++;
			}
		}
		if(options.deep)
			var context=options.context.splice(0,options.context.length);
		if(options.deep===true){
			for (var i=0;i<context.length ;i++ )
				this.addNodes(context[i].getElementsByTagName(v),options.contextID,options.context);
		}else if(options.deep>0){
			for (var i=0;i<context.length ;i++ )
			this.walkNode(context[i],function(n){
				if (n.tagName==v)
					this.addNodes(n,options.contextID,options.context);
			},options.deep);
		}
	},
	'.':function(v,options){//classname
		var context=options.context.splice(0,options.context.length);
		var v1=' '+v+' ';
		if (options.withcontext){
			for (var i=0;i<context.length ;i++ ){
				var cn=' '+(this.Attr(context[i],'class')||'')+' ';
				if (cn.indexOf(v1)!=-1){
					this.addNodes(context[i],options.contextID,options.context);
				}
			}
		}else if(options.deep)
		if(typeof document.getElementsByClassName=='function'){
			for (var i=0;i<context.length ;i++ ){
				this.addNodes(context[i].getElementsByClassName(v),options.contextID,options.context);
			}
		}else{
			for (var i=0;i<context.length ;i++ )
			this.walkNode(context[i],function(n){
				var cn=' '+(this.Attr(n,'class')||'')+' ';
				if (cn.indexOf(v1)!=-1)
					this.addNodes(n,options.contextID,options.context);
			},options.deep);
		}
	},
	'>':function(v,options){//child
		var tag='*';
		if(v) tag=v.toUpperCase();
		if ('&, #.>+~[:'.indexOf(tag)!=-1){
			tag=false;
			options.at--;options.deep=false;options.withcontext=true;
		}else{
			options.deep=true;options.withcontext=false;
			if (tag===(options.expr[options.at-2]||'').toUpperCase()) {
				var ns,context=options.context.splice(0,options.context.length);
				for (var i=0;i<context.length ;i++){
					ns=context[i].childNodes;
					for (var j=0;j<ns.length;j++ ) {
						if (ns[j].tagName===tag){
							options.context.push(context[i]);
							break;
						}
					}
				}
				return;
			}
		}
		var n,context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++){
			n=context[i].firstChild;
			while(n){
				if (n.nodeType==1 && (n.tagName===tag || false===tag || tag=='*'))
					if(false===this.addNodes(n,options.contextID,options.context)) break;
				n=n.nextSibling;
			}
		}
	},
	'+':function(v,options,ret){//siblings
		var tag='*';
		if(v) tag=v.toUpperCase();
		if ('&, #.>+~[:'.indexOf(tag)!=-1){
			tag=false;
			options.at--;options.deep=false;options.withcontext=true;
		}else{
			options.deep=true;options.withcontext=false;
		}
		var n,context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++ ){
			n=context[i].nextSibling;
			while(n && n.nodeType!=1) n=n.nextSibling;
			if (n && n.nodeType==1 && (tag===false || n.tagName===tag || tag==='*'))
				this.addNodes(n,options.contextID,options.context);
		}
	},
	'~':function(v,options){//匹配 prev 元素之后的所有匹配的 siblings 元素,
		var tag='*';
		if(v) tag=v.toUpperCase();
		if ('&, #.>+~[:'.indexOf(tag)!=-1){
			tag=false;
			options.at--;options.deep=false;options.withcontext=true;
		}else{
			options.deep=true;options.withcontext=false;
			if (tag===(options.expr[options.at-2]||'').toUpperCase()) {
				var context=options.context.splice(0,options.context.length);
				for (var i=0;i<context.length ;i++){
					var p=context[i].parentNode;
					for (var j=i+1;j<context.length ;j++){
						if (p===context[j].parentNode)
							if(false==this.addNodes(context[j],options.contextID,options.context))
								break;
					}
				}
				return;
			}
		}
		var context=options.context.splice(0,options.context.length);
		var id=0;
		for (var i=0;i<context.length ;i++ ){
			var ns=context[i];
			if (ns.parentNode){
				if(id===ns.parentNode.inQueryID) continue;
				ns.parentNode.inQueryID=id=ns.parentNode.inQueryID||this.inID++;
			}
			while(ns=ns.nextSibling){
				if (ns.nodeType==1 && (tag===false || ns.tagName===tag|| tag==='*'))
					if(false==this.addNodes(ns,options.contextID,options.context)) break;
			}
		}
	},
	'[':function(v,options){
		var context=options.context.splice(0,options.context.length);
		var s=['',''],i=0;options.at--;
		while(options.expr[options.at] && options.expr[options.at]!=']')
			s[i++]=options.expr[options.at++];
		options.at++;
		function c(av,op,v){
			switch(op){
			case ''  :return av;
			case '=' :return av==v;
			case '!=':return !(av==v);
			case '~=':return av && av.search(new RegExp('(\s+|^)'+v+'(\s+|$)'))!=-1;
			case '^=':return av && av.search(new RegExp('^'+v))!=-1;
			case '|=':return av && av.search(new RegExp('^'+v+'-'))!=-1;
			case '$=':return av && av.search(new RegExp(v+'$'))!=-1;
			case '*=':return av.search(v)!=-1;
			}
			return false;
		}
		if(s[0]==="class") s[0]=="className";
		else
		if(s[0]==="for" ) s[0]='htmlFor';
		if (options.withcontext){
			var av;
			for (var i=0;i<context.length;i++ ){
				av= context[i].getAttribute(s[0])||context[i][s[0]];
				if(av && c(av,s[1],s[2]))
					this.addNodes(context[i],options.contextID,options.context);
			}
		}else
		for (var i=0;i<context.length ;i++ ){
			this.walkNode(context[i],function(n){
				var av= n.getAttribute(s[0])||n[[0]];
				if(av && c(av,s[1],s[2]))
					this.addNodes(n,options.contextID,options.context);
			},options.deep);
		}
	},
	'&':function(v,options){
		this.addNodes(options.context,options.retID,options.ret);
		options.at--;options.deep=true;options.withcontext=false;
	},
	',':function(v,options){
		this.addNodes(options.context,options.retID,options.ret);
		options.at--;options.deep=true;options.withcontext=false;
		options.context=options.root.slice(0);
	},
	' ':function(v,options){
		options.at--;options.deep=true;options.withcontext=false;
	},
	'*':function(v,options){
		options.at--;options.deep=false;options.withcontext=false;
		var context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++)
			this.addNodes(context[i].getElementsByTagName('*'),options.contextID,options.context);
	},
	'#':function(v,options){//id
		//options.withcontext=options.expr[options.at-3] && options.expr[options.at-3]!=' ';
		var elem=document.getElementById(v);
		if (!elem) return [];
		if (options.withcontext){
			for (var i=0;i<options.context.length ;i++ )
				if(options.context[i].id==v && options.context[i]===elem){
					options.context=[elem];
					return;
				}
		}
		if (options.deep){
			for (var i=0;i<options.context.length ;i++ )
				this.traceNode(elem.parentNode,function(n){
					if (options.context[i]===n){
						options.context=[elem];
						return;
					}
				});
		}
	},
	':':function(v,options){
		if (v=='not(') {
			var c=1;
			var at=options.at;
			while(c){
				if (options.expr[options.at].indexOf('(')!=-1) c++;
				else if (options.expr[options.at].indexOf(')')!=-1) c--;
				options.at++;
			}
			var expr=options.expr.slice(at,options.at);
			expr[expr.length-1]=expr[expr.length-1].replace(')','');
			var opt={expr:expr,contextID:{},retID:{},at:0,deep:false,withcontext:true,
			root:options.context.slice(0),context:options.context.slice(0),ret:[]};
			while(this.Query(opt));
			this.not(options,opt.ret);
		}else{
			v=v.split(/\(|\)/);
			for (var i=0;i<v.length ; )
				if (''==v[i]) v.splice(i,1);else i++;
			if (v[0]=='odd' || v[0]=='even') {
				v[1]=v[0];
				v[0]='nth-child';
			}
			if (v[1]){
				if (v[0].indexOf('-')!=-1) {
					v[1]=v[1].replace(/even/, "2n+0").replace(/odd/, "2n+1");
					var tmp=v[1].split('n');
					if (tmp.length==1){
						v[1]=0;
						v[2]=parseInt(tmp[0]);
					}else{
						v[1]=parseInt(tmp[0]==''?1:(tmp[0]=='-'?-1:tmp[0]));
						v[2]=parseInt(tmp[1])||0;
					}
				}else{
				}
			}
		}
		if (typeof this[v[0]]!='function') return [];
		options.withcontext=true;
		this[v[0]](options,v[1],v[2]);
	},
	root:function(){
		return [document.firstChild];
	},
	checkAttr:function(options,attr,v){
		var ret=[];
		for (var i=0;i<context.length ;i++ ) {
			if (withcontext)
				if (v===this.Attr(context[i],attr))
					ret.push(context[i]);
			if(deep)
				this.walkNode(context[i],function(nd){
					if (v==this.Attr(nd,attr))
						ret.push(nd);
				},deep);
		}
		return ret;
	},
	nodeAt:function(options,a,b,reverse){
		var x=0;
		var context=options.context.splice(0,options.context.length);
		var session=this.inID;
		if (options.withcontext)
		for (var i=0;i<context.length ;i++ ) {
			if (!context[i].inQueryID || context[i].inQueryID<session){
				x=0;
				var ns=reverse?context[i].parentNode.lastChild:context[i].parentNode.firstChild;
				while(ns){
					if (ns.nodeType==1){
						ns.nodeIndex=++x;
						ns.inQueryID=this.inID++;
					}
					ns=reverse?ns.previousSibling:ns.nextSibling;
				}
			}
			x=context[i].nodeIndex;
			if (a>0?x%a==b:a==0?x==b:x<b)
				this.addNodes(context[i],options.contextID,options.context);
		}
	},
	'nth-child':function(options,a,b){
		this.nodeAt(options,a,b);
	},
	'nth-last-child':function(options,a,b){
		return this.nodeAt(options,a,b,true);
	},
	'nth-of-type':function(options,a,b){
		return this.nodeAt(options,a,b);
	},
	'nth-last-of-type':function(options,a,b){
		return this.nodeAt(options,a,b,true);
	},
	'first-child':function(options,a,b){
		return this.nodeAt(options,0,1);
	},
	'last-child':function(options,a,b){
		return this.nodeAt(options,0,1,true);
	},
	'first-of-type':function(options,a,b){
		return this.nodeAt(options,0,1);
	},
	'last-of-type':function(options,a,b){
		return this.nodeAt(options,0,1,true);
	},
	'only-child':function(options,a,b){
		var context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++ ) {
			if(this.childNodesCount(context[i].parentNode,true)==1)
				options.context.push(context[i]);
		}
	},
	'only-of-type':function(options,a,b){
		var context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++) {
			if(this.childNodesCount(context[i].parentNode,true,context[i].tagName)==1)
				options.context.push(context[i]);
		}
	},
	parent:function(options){
	},
	contains:function(options,v){
		var context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++) {
			if ((context[i].textContent || context[i].innerText || "").indexOf(v)!=-1)
				options.context.push(context[i]);
		}
	},
	not:function(options,v){
		for (var i=0;i<v.length ;i++) {
			for (var j=0;j<options.context.length ;)
				if (v[i]===options.context[j]){
					options.context.splice(j,1);
				}else j++;
		}
	},
	empty:function(options){
		var context=options.context.splice(0,options.context.length);
		for (var i=0;i<context.length ;i++) {
			if (options.withcontext){
				if(0==this.childNodesCount(context[i],true))
					options.context.push(context[i]);
			}
		}
	},/*link:visited:active:hover:focus:target:lang:*/
	enabled:function(options){
		return this.checkAttr(options,'disabled',false);
	},
	disabled:function(options){
		return this.checkAttr(options,'disabled',true);
	},
	checked:function(options){
		return this.checkAttr(options,'checked','checked');
	}
});