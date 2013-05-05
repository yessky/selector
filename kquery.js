/*
 * kquery - a super fast and compatible CSS selector engine
 * Copyright (C) 2011 - 2013 aaron.xiao
 * Author: aaron.xiao <admin@veryos.com>
 * Version: 2.0
 * Release: 2013/05/04
 * License: http://kquery.veryos.com/MIT-LICENSE
 * Credits: 
 * Q.js - https://github.com/hackwaly/Q
 *   - the idea of compile system
 * Sizzle.js - http://sizzlejs.org
 *   - qsa buggy detection
 */

(function( window ) {

var document = window.document,
	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",
	// http://www.w3.org/TR/css3-syntax/#characters
	encoding = "(?:\\\\.|[-\\w]|[^\\x00-\\xa0])",
	// Css identifier characters
	identifier = "(?:\\.|#|:|::)",
	// Use loosely tagName encoding for special dtd
	tags = encoding + "+|\\*",
	// Acceptable operators http://www.w3.org/TR/selectors/#attribute-selectors
	operators = "([*^$|!~]?=)",
	attributes = "\\[" + whitespace + "*(" + encoding + "+)" + whitespace +
		"*(?:" + operators + whitespace + "*(?:(['\"])?((?:\\\\.|[^\\\\])*?)\\3))?" +
		whitespace + "*\\]",
	pseudos = "\\((\\([^()]+\\)|[^()]+)+\\)",
	combinators = whitespace + "*([\\x20\\t\\r\\n\\f>+~,])" + whitespace + "*",
	groups = "(?=[^\\x20\\t\\r\\n\\f])(?:\\\\.|" + attributes +
		"|(" + identifier + "?)(" + tags + ")(?:" + pseudos + ")?|[^\\\\(),])+",
	matches = "(?:" + attributes + "(?!" + tags + "))|(" + identifier + "?)(" +
		tags + ")(?:" + pseudos + "(?!" + tags + "))?|(?:" + combinators + ")",

	rwhitespace = new RegExp( whitespace + "+" ),
	rpos = /([+\-]?)(\d*)(?:n([+\-]?\d*))?/,
	rsibling = /^[\x20\t\r\n\f]*[+~]/,
	rgroups = new RegExp( groups + "?(?=" + whitespace + "*,|$)", "g" ),
	rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,
	rmatches = new RegExp( matches, "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" +
		whitespace + "+$", "g" ),
	rescape = /'|\\/g,
	rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,
	rvalidator = /\(.+?\)|\[.+?\]/g,

	tarray = [],
	push = tarray.push,
	slice = tarray.slice,
	push_native = tarray.push,

	strundef = typeof undefined,
	strnthchild = 'if ( b === 0 ) { if ( a === 0 ) { return false; }' +
		'if ( a === 1 ) { return true; } }' +
		'var p = node.parentNode, count = 0, pos, tag, t, c;' +
		'if ( p && (p._kqcache !== cache || !node._kqindex) ) {' +
		'${0} for ( t = p.${1}; t; t = t.${2} ) {' +
		'${3} } p._kqcache = cache; p._kqcount = count; }' +
		'pos = revs ? p._kqcount - node._kqindex + 1 : node._kqindex;' +
		'return a ? (pos - b) % a === 0 : pos === b;',
	strnthpos = 'var tag = node.nodeName; while ( node = node.${0} ) {' +
		'if ( node.nodeName === tag ) { return false; } } return true;',

	hasDuplicate = false,
	kqid = 'kqset-' + now(),
	kqset = 1,
	contexts = {},
	setContext,
	tokenize,
	compile,
	query,

	byId,
	isNthChild,
	isTypeNthChild,
	isTypeFirst,
	isTypeLast,
	contains,
	sortOrders,
	getText;

try {
	push.apply(
		(tarray = slice.call( document.childNodes )),
		document.childNodes
	);
} catch ( e ) {
	push = {apply: tarray.length ?
		function( target, sender ) {
			push_native.apply( target, slice.call(sender) );
		} :
		function( target, sender ) {
			var j = target.length, i = 0;
			while ( (target[j++] = sender[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function createCache( len ) {
	var keys = [], un = typeof len !== strundef, cache;

	return (cache = function( key, value ) {
		if ( ( key += ' ' ) && un && keys.push( key ) > len ) {
			delete cache[ keys.shift() ];
		}
		return ( cache[ key ] = value );
	});
}

function isXML( node ) {
	var r = node && (node.ownerDocument || node).documentElement;
	return r ? r.nodeName !== 'HTML' : false;
}

function isNative( fn ) {
	return ( fn + '' ).indexOf( '[native code]' ) !== -1;
}

function format( template, props ) {
	return template.replace(/\$\{([^\}]+)\}/g, function(m, p) {
		return typeof props[p] === strundef ? m : props[p] + '';
	});
}

function make( type, array ) {
	return ( array._type = type, array );
}

function order( a, b ) {
	return a._tr - b._tr;
}

function now() {
	return new Date().getTime();
}

function toFunc( args, fn, subs ) {
	return new Function( args, format(fn, subs) );
}

function uniqueSort( results, sortOrder ) {
	var dups = [], k = 0, i = 0, elem;

	sortOrder && results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				k = dups.push( i );
			}
		}
		while ( k-- ) {
			results.splice( dups[ k ], 1 );
		}
		hasDuplicate = false;
	}

	return results;
}

function siblingCheck( a, b ) {
	if ( a === b ) {
		return 0;
	}

	var cur = a.nextSibling;

	while ( cur ) {
		if ( cur === b ) { return -1; }
		cur = cur.nextSibling;
	}

	return 1;
}

// === Features/Bugs detection and Template variables of complier ===
setContext = function( doc ) {
	var kid = doc._kqset;

	if ( kid ) { return contexts[ kid ]; }

	var root = doc.documentElement, ks = kqset++,
		byid = isNative( doc.getElementById ),
		walkChildren = ('children' in root),
		walkElement = Number( 'firstElementChild' in root ),
		compos = Number( isNative(root.compareDocumentPosition) ),
		qsa = isNative( doc.querySelectorAll ),
		attr = isNative( root.hasAttribute ),
		context = {}, has, vars, xdoc, buggyById;

	doc._kqset = context.id = ks;
	xdoc = context.isXML = isXML( doc );
	context.selectors = {};

	// Features/Bugs detection
	has = context.has = {
		qsa: qsa,
		attr: attr,
		compos: compos,
		text: ('textContent' in root),
		byId: byid,
		byElement: walkElement,
		byChildren: walkChildren,
		byChildrenTag: walkChildren && ('tags' in root.children)
	};

	(function() {
		var div = doc.createElement('div'), node;

		// NOTE: Windows 8 Native Apps
		// The type attribute is restricted during .innerHTML assignment

		div.innerHTML = '<!-- # --><i class="hidden e"></i><i class="hidden"></i>';
		// Opera can't find the second classname (in 9.6)
		// getElementsByClassName does not work on XML document
		if ( !div.getElementsByClassName ||
			div.getElementsByClassName('e').length === 0 ) {
			has.byClass = false;
		} else {
			// Safari caches class attributes, doesn't catch changes (in 3.2)
			div.lastChild.className = "e";
			has.byClass = div.getElementsByClassName('e').length === 2;
		}

		// IE will return comment node
		has.byTagWithComment = div.getElementsByTagName('*').length > 3;

		// TODO: this check is necessary ?
		/*div.innerHTML = '<a name="' + kqid + '"></a><div id="' + kqid + '">';
		node = div.getElementsByTagName('*')[kqid];
		// IE returns HTMLCollection in html document.
		if ( node && node.length > 1) {
			has.buggyByTagId = true;
			node = node[1];
		}
		has.byTagId = node === div.lastChild;*/

		// Support: Windows 8 Native Apps
		// Assigning innerHTML with "name" attributes throws uncatchable exceptions
		// http://msdn.microsoft.com/en-us/library/ie/hh465388.aspx
		div = doc.createElement('div');
		div.appendChild( doc.createElement('a') ).setAttribute( 'name', kqid );
		div.appendChild( doc.createElement('i') ).setAttribute( 'name', kqid );
		root.appendChild( div ).setAttribute( 'id', kqid + 0 );

		has.byName = doc.getElementsByName &&
			doc.getElementsByName( kqid ).length === 2 +
			doc.getElementsByName( kqid + 0 ).length;
		buggyById = has.buggyById = byid && !!doc.getElementById( kqid );
		root.removeChild( div );

		if ( qsa ) {
			var rbuggyQSA = [], input, matches;

			div.innerHTML = '<i class="c" id="d"></i><select><option selected=""></option></select>';
			// IE9/10 - querySelectorAll not with ID/CLASS selector under XML Document
			if ( !div.querySelectorAll('.c').length ) {
				rbuggyQSA.push( '\\.' + encoding );
			}
			if ( !div.querySelectorAll('#d').length ) {
				rbuggyQSA.push( '#' + encoding );
			}
			// IE8 - Some boolean attributes are not treated correctly
			if ( !div.querySelectorAll('[selected]').length ) {
				rbuggyQSA.push( '\\[' + whitespace + '*checked|disabled|ismap|multiple|readonly|selected|value' + whitespace + '*(?:[*^$|!~\]])' );
			}
			// :checked should return selected option elements
			// IE8 throws exceptions for some dynamic pseudos
			try {
				if ( !div.querySelectorAll(':checked').length ) {
					rbuggyQSA.push(':checked');
				}
			} catch ( e ) {}

			// Support: Opera 10-12/IE8
			// ^= $= *= and empty values
			// Should not select anything
			input = doc.createElement( 'input' );
			input.setAttribute( 'type', 'hidden' );
			div.appendChild( input ).setAttribute( 'i', '' );

			try {
				if ( div.querySelectorAll('[i^=""]').length ) {
					rbuggyQSA.push( '[*^$]=' + whitespace + '*(?:""|\'\')' );
				}

				// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
				// IE8 throws error here, later test will be ignore
				if ( !div.querySelectorAll(':enabled').length ) {
					rbuggyQSA.push( ':enabled', ':disabled' );
				}

				// Opera 10-11 does not throw on post-comma invalid pseudos
				div.querySelectorAll( '*,:x' );
				rbuggyQSA.push( ',.*:' );
			} catch (e) {}

			if ( isNative( (matches = root.webkitMatchesSelector ||
				root.mozMatchesSelector ||
				root.oMatchesSelector ||
				root.msMatchesSelector) ) ) {

				context.matches = matches;
				// Check to see if it's possible to do matchesSelector
				// on a disconnected node (IE 9)
				has.disconnectedMatch = matches.call( doc.createElement('div'), 'div' );
			}

			context.rqsaBugs = rbuggyQSA.length && new RegExp( rbuggyQSA.join('|') );
		}

		div = node = null;
	})();

	// Teamplate variables for complier
	var refinders = {'#': 10, '>T': 8, 'N': 7, '.': 6},
		strecontains = compos ?
			'${0}.compareDocumentPosition(${1})&16' : '${0}.contains(${1})',
		strehash = '${N}.kqset||(${N}.kqset=++done)',
		streuniquemain = 'if(t=${N}h[' + strehash + ']){if(t._){break P_${R};}' +
			'else{break NP_${R};}}${N}h[' + strehash + ']=${R}V;${X}',
		stretest = format( streuniquemain, {X: 'if(${N}!==${R}){${X}}'} ),
		streloopmain = 'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		streinputs = 'var ${N}a=' +
			'query("input,select,textarea,option",doc,null,doc,context);' +
			'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){',
		streelem = has.byTagWithComment ? 'if(${N}.nodeType===1){${X}}' : '${X}',
		stretags = 'var ${N}a=${R}.getElementsByTagName("*");' + format( streloopmain, {X: streelem} ),
		strelink = 'var ${N}a=${R}.getElementsByTagName("a");' + streloopmain,
		streattr = '(t=${A})&&t.indexOf("${1}")',
		strecache = '/*^var rev=query.kqcache;^*/',
		strechild = '/*^var isNthChild=context.isNthChild;^*/',
		stretype = '/*^var isTypeNthChild=context.isTypeNthChild;^*/';

	// Priority of seed selector
	context.finders = {
		':root': 10, '+': 10,
		'#': byid ? refinders['#'] : 0,
		'>T': has.byChildrenTag ? refinders['>T'] : 0,
		'N': has.byName ? refinders['N'] : 0,
		'.': has.byClass ? refinders['.'] : 0,
		'>': 6, '~': 6, 'T': 5,
		':checked': 4, ':enabled': 4, ':disabled': 4,
		':link': 3, ':visited': 3, '*': 0
	};

	vars = context.vars = {
		main: 'function(root, doc, context){var result=[],' +
			'xml=context.isXML,done=query.kqset,l=0,t,r;' +
			'BQ:{${X}}query.kqset=done;return result;}',
		left: 'var ${R}V={_:false};NP_${R}:{P_${R}:{${X}break NP_${R};}${R}V._=true;${Y}}',
		strip: '/*^var ${N}l;^*/if(!${N}l||!(' +
			format( strecontains, ['${N}l', '${N}'] ) +')){${X}${N}l=${N};}',
		unique: '/*^var ${N}h={};^*/if(${N}h[' + strehash + '])break;' +
			'${N}h[' + strehash + ']=1;${X}',
		loopbreak: 'break P_${R};',
		push: 'result[l++]=${N};',
		link: '/*^var tag_a=xml?"a":"A";^*/'
	};

	// Combination filter
	vars.comb = {
		'>': '/*^var ${N}h={};^*/var ${N}=${C}.parentNode;' + stretest,
		' ': '/*^var ${N}h={};^*/var ${N}=${C};' +
			'while(${N}=${N}.parentNode){' + stretest + '}',
		'+': walkElement ?
			'/*^var ${N}h={};var ${N};^*/if(${N}=${C}.previousElementSibling){${X}}' :
			'/*^var ${N}h={};^*/var ${N}=${C};' +
			'while(${N}=${N}.previousSibling){if(${N}.nodeType===1){${X}break;}}',
		'~': walkElement ?
			'/*^var ${N}h={};^*/var ${N}=${C};' +
			'while(${N}=${N}.previousElementSibling){' + streuniquemain + '}' :
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling)' +
			'{if(${N}.nodeType===1){' + streuniquemain + '}}'
	};

	// Seed selectors
	vars.find = {
		'#': 'var ${N}=context.byId("${P}",${R},doc);if(${N}){${X}}',
		'N': '/*^var isdoc=${R}===doc;^*/var ${N}a=doc.getElementsByName("${P}");' +
			'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){if(isdoc||' +
			format( strecontains, ['${R}', '${N}'] ) + '){${X}}}',
		'T': 'var ${N}a=${R}.getElementsByTagName("${P}");' + streloopmain,
		'.': 'var ${N}a=${R}.getElementsByClassName("${P}");' + streloopmain,
		'*': stretags,
		'[': stretags,
		'+': walkElement ?
			'/*^var ${N};^*/if(${N}=${R}.nextElementSibling){${X}}' :
			'var ${N}=${R};while(${N}=${N}.nextSibling){if(${N}.nodeType===1){${X}break;}}',
		'~': walkElement ?
			'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextElementSibling){' +
			'if(${N}h[' + strehash + '])break;${N}h[' + strehash + ']=1;${X}}' :
			'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextSibling){' +
			'if(${N}.nodeType===1){if(${N}h[' + strehash + '])break;' +
			'${N}h[' + strehash + ']=1;${X}}}',
		'>': walkChildren ? 
			'var ${N}a=${R}.children;' + streloopmain :
			'var ${N}a=${R}.childNodes;' + format( streloopmain, {X: 'if(${N}.nodeType===1){${X}}'}),
		'>T': 'var ${N}a=${R}.children.tags("${P}");' + streloopmain,
		':root': 'var ${N}a=[doc.documentElement];' + streloopmain,
		':link': strelink,
		':visited': strelink,
		':checked': 'var ${N}a=${R}.getElementsByTagName("input");' + streloopmain,
		':enabled': streinputs + 'if(${N}.disabled===false){${X}}}',
		':disabled': streinputs + 'if(${N}.disabled===true){${X}}}'
	};

	// Check ancestor/sibling
	vars.cond = {
		'>': 'if(${N}.parentNode===root){${X}}',
		'+': walkElement ?
			'if(${N}.previousElementSibling===root){${X}}' :
			'var ${N}=${C};while(${N}=${N}.previousSibling){' +
			'if(${N}.nodeType===1){break}}if(${N}===root){${X}}',
		'~': walkElement ?
			'if(root.compareDocumentPosition(${N})&4){${X}}' :
			'if((root!=${N}&&root.contains(${N})&&16 )+' +
			'(root!=${N}&&${N}.contains(root)&&8)+(root.nodeType===1?' +
			'(root.sourceIndex<${N}.sourceIndex&&4)+(' +
			'root.sourceIndex>${N}.sourceIndex&&2):1)&4){${X}}'
	};

	// Condition filters
	vars.filter = {
		'T': '/*^var ${N}t=xml?"${0}":("${0}").toUpperCase();^*/' +
			(xdoc ? '((r=${N}.nodeName)&&(t=r.indexOf(":"))>0&&' +
			'r.substr(t+1)||r)' : '${N}.nodeName') + '===${N}t',
		'#': '${N}.getAttribute("id")==="${0}"',
		'N': '${N}.getAttribute("name")==="${0}"',
		'[': attr ?
			'${N}.hasAttribute("${0}")' : '(t=${N}.getAttributeNode("${0}"))&&(t.specified)',
		'=': '${A}==="${1}"',
		'!=': '${A}!=="${1}"',
		'^=': streattr + '===0',
		'$=': streattr + '===(t.length - "${1}".length)',
		'*=': streattr + '!==-1',
		'|=': '(t=${A})&&t.indexOf("-${1}-")!==-1',
		'~=': '(t=${A})&&(" "+t+" ").indexOf("${1}")!==-1',
		'*': '',

		':nth-child': strecache + strechild + 'isNthChild(${N},${1},${2},rev)',
		':nth-last-child': strecache + strechild + 'isNthChild(${N},${1},${2},rev,1)',
		':nth-of-type': strecache + stretype + 'isTypeNthChild(${N},${1},${2},rev)',
		':nth-last-of-type':strecache + stretype + 'isTypeNthChild(${N},${1},${2},rev,1)',
		':first-child': walkElement ?
			'!${N}.previousElementSibling' :
			'/*^var isFirstChild=query.isFirstChild;^*/isFirstChild(${N})',
		':last-child': walkElement ?
			'!${N}.nextElementSibling' :
			'/*^var isLastChild=query.isLastChild;^*/isLastChild(${N})',
		':only-child': walkElement ?
			'!${N}.previousElementSibling&&!${N}.nextElementSibling' :
			'/*^var isOnlyChild=query.isOnlyChild;^*/isOnlyChild(${N})',
		':first-of-type': '/*^var isTypeFirst=context.isTypeFirst;^*/isTypeFirst(${N})',
		':last-of-type': '/*^var isTypeLast=context.isTypeLast;^*/isTypeLast(${N})',
		':only-of-type': '/*^var isTypeOnly=context.isTypeOnly;^*/isTypeOnly(${N})',

		':root': '${N}===doc.documentElement',
		':empty': '!${N}.firstChild',
		':lang': '${N}.lang==="${0}"',

		// FIXME: investigation :visited
		':link': vars.link + '${N}.nodeName===tag_a',
		':visited': 'false',
		':hover': '${N}===doc.hoverElement',

		':active': '${N}===doc.activeElement',
		':focus': '${N}===doc.activeElement&&(!doc.hasFocus||' +
			'doc.hasFocus())&&!!(${N}.type||${N}.href)',
		':target': '${N}.id&&doc.location.hash.slice(1)===${N}.id',

		':enabled': '${N}.disabled===false',
		':disabled': '${N}.disabled===true',
		':checked': '${N}.checked===true',

		// Does not match an element
		'::first-line': 'false',
		'::first-letter': 'false',
		'::before': 'false',
		'::after': 'false',
		// Dynamically generate while compiling
		':not': '',

		// Extended pseudos selectors
		':element': '${N}.nodeType===1',
		// For support selector ':contains(text)'
		':contains': (has.text ? '${N}.textContent' :
			(xdoc ? '/*^var getText=query.getText;^*/getText(${N})' : '${N}.innerText')) +
			'.indexOf("${0}")>-1',
		':not-ex': '/*^var _${G}=query.hashSet(query("${1}",doc,null,doc,context));' +
			'done=query.kqset;^*/!_${G}[' + strehash + ']',
		':has': '(t=query("${1}",${N},null,doc,context),done=query.kqset,t.length>0)'
	};

	context.contains = contains[ compos ? 0 : (root.contains ? 1 : 2) ];
	context.sortOrder = sortOrders[ compos ? 0 : (('sourceIndex' in root) ? 1 : 2) ];

	context.byId = byId[ byid ? (buggyById ? 0 : 1) : 2 ];
	// :nth-child(xxxx) :ntn-last-child(xxx)
	context.isNthChild = isNthChild[ walkElement ];
	// :nth-of-type(xxx) :nth-last-of-type(xxx)
	context.isTypeNthChild = isTypeNthChild[ walkElement ];
	// :first-of-type
	context.isTypeFirst = isTypeFirst[ walkElement ];
	// :last-of-type
	context.isTypeLast = isTypeLast[ walkElement ];
	// :only-of-type
	context.isTypeOnly = function( node ) {
		return context.isTypeLast( node ) && context.isTypeFirst( node );
	};

	return ( contexts[ ks ] = context );
};

tokenize = (function() {
	var text, index;

	function error() {
		return kquery.error( [text,  "character: " + index].join(', ') );
	}

	function match( regex ) {
		var mc = ( regex.lastIndex = index, regex.exec(text) );
		return mc && mc.index == index ? (index = regex.lastIndex, mc) : null;
	}

	function parse() {
		var m, q = [], c = [q], g = [c], x;

		while ( (m = match(rmatches)) !== null ) {
			// [ ~+>,] group or combination selector
			if ( m[8] ) {
				// Selector starts with ','
				if ( m[8] === "," ) {
					if ( c.length === 1 && q.length === 0 ) { break; }
					g.push( c = [ q = [] ] );
				}
				// Invalid combination  div + + div
				else {
					if ( q.length === 0 && q._union ) { break; }
					c.length === 1 && q.length && ( q._union = q._union || " " );
					(c.length > 1 || c.length === 1 && q.length) && c.push( q = [] );
					q._union = m[8].replace( rwhitespace, " " );
				}
			}
			// Attribute selector [attr='xxx']
			else if ( m[1] ) {
				// [attr='xxx']
				if ( m[2] && typeof( m[4] ) !== strundef ) {
					q.push( make(m[2], [m[1], m[4]]) );
				}
				// [attr]
				else {
					q.push( make("[", [m[1]]) );
				}
			}
			// .class #ID :pseduo
			else if ( m[6] ) {
				if ( m[5] ) {
					// .class | #id
					if ( m[5].indexOf(":") === -1 ) {
						q.push( make(m[5], [m[6]]) );
					}
					// [:|::]pseduo
					else {
						x = m[5] + m[6];

						if ( m[7] ) {
							if ( x === ':not' || x === ':has' ) {
								var xi = index, xt = text;

								text = text.slice( xi - m[7].length - 1, xi - 1 );
								q.push( make(x, [(index = 0, parse()), text]) );
								( index = xi, text = xt );
							} else {
								q.push( make(x, [ m[7] ]) );
							}
						} else {
							q.push( make(x, m[5] === '::' ? [x] : [m[6]]) );
						}
					}
				} else {
					q.push( make("T", [m[6]]) );
				}
			}
		}

		return g;
	}

	return function( expr ) {
		// Speed test in 1000 times run.
		// IE: cache->13ms uncache->17-19ms
		// chrome: cache->8ms uncache->10ms
		var tkns = tokenize.cache( expr );

		if ( !tkns ) {
			text = expr;
			index = 0;
			expr = parse();
			match( /\s*/g );

			if ( index < text.length ) {
				error();
			}

			tkns = tokenize.cache( text, expr );
		}

		return tkns;
	};
})();

tokenize.store = createCache();
tokenize.cache = function( expr, value ) {
	value = value ? this.store( expr, value ) : this.store[ expr + ' ' ];
	return value ? this.clone( value ) : value;
};
tokenize.clone = function( src ) {
	var i = 0, deep = src[0] instanceof Array, g, q, c;

	function cp( a, b ) {
		if ( typeof b._type !== strundef ) {
			a._type = b._type;
		}
		if ( typeof b._union !== strundef ) {
			a._union = b._union;
		}
	}

	if ( deep ) {
		g = [];
		for ( ; q = src[i]; i++ ) {
			g.push( c = this.clone(q) );
			cp( c, q );
		}
	} else {
		g = src.slice(0);
		cp( g, src );
	}

	return g;
};

query = function( expr, root, seed, doc, context ) {
	var result = compile( expr, context )( root, doc, context );
	query.kqcache += 1;
	return seed ? query.matchSet( seed, result ) : result;
};

query.kqcache = query.kqset = 1;

query.hashSet = function( array ) {
	var cached = array.kqhash, i, kq, it;

	if ( !cached ) {
		i = array.length;
		kq = query.kqset;

		cached = array.kqhash = {};
		while ( i-- ) {
			it = array[i];
			cached[ it.kqset || (it.kqset = ++kq) ] = 1;
		}
		query.kqset = kq;
	}

	return cached;
};

function matchSet( seed, array ) {
	var cached = query.hashSet( array ), result = [], i = 0, elem;

	for ( ; node = seed[i]; i++ ) {
		if ( cached[node.kqset || (node.kqset = ++query.kqset)] ) {
			result.push( node );
		}
	}

	return result;
}

contains = [
	function( a, b ) {
		return !!(a.compareDocumentPosition(b) & 16);
	},
	function( a, b ) {
		return a !== b && (a.contains ? a.contains(b) : true);
	},
	function( a, b ) {
		while ( (b = b.parentNode) ) {
			if ( a === b ) { return true; }
		}
		return false;
	}
];

sortOrders = [
	function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		return ( !a.compareDocumentPosition || !b.compareDocumentPosition ?
			a.compareDocumentPosition :
			a.compareDocumentPosition(b) & 4
		) ? -1 : 1;
	},
	function( a, b ) {
		return a.sourceIndex - b.sourceIndex > 0 ? 1 : -1;
	},
	function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var al, bl, i,
			ap = [],
			bp = [],
			aup = a.parentNode,
			bup = b.parentNode,
			cur = aup;

		if ( aup === bup ) { return siblingCheck( a, b ); }

		// Otherwise they're somewhere else in the tree so we need
		// to build up a full list of the parentNodes for comparison
		while ( cur ) {
			ap.unshift( cur );
			cur = cur.parentNode;
		}

		cur = bup;

		while ( cur ) {
			bp.unshift( cur );
			cur = cur.parentNode;
		}

		al = ap.length;
		bl = bp.length;

		// Start walking down the tree looking for a discrepancy
		for ( i = 0; i < al && i < bl; i++ ) {
			if ( ap[i] !== bp[i] ) {
				return siblingCheck( ap[i], bp[i] );
			}
		}
	}
];

byId = [
	function( id, node, doc ) {
		var m = doc.getElementById( id );

		return m && m.parentNode ?
			( node.nodeType === 1 && context.contains(node, m) ) && m.id === id ||
			typeof m.getAttributeNode !== strundef &&
			m.getAttributeNode('id').value === id ?
				m :
				null :
			null;
	},
	function( id, node, doc ) {
		var m = doc.getElementById( id );
		return m && m.parentNode ? m : null;
	},
	function( id, node, doc ) {
		return node.getElementsByTagName('*')[ id ];
	}
];

isNthChild = [
	toFunc('node,a,b,cache,revs', strnthchild, [
		'',
		'firstChild',
		'nextSibling',
		'if ( t.nodeType === 1 ) { t._kqindex = ++count; }'
	]),
	toFunc('node,a,b,cache,revs', strnthchild, [
		'',
		'firstElementChild',
		'nextElementSibling',
		't._kqindex = ++count'
	])
];

isTypeNthChild = [
	toFunc('node,a,b,cache,revs', strnthchild, [
		'tag = node.nodeName;',
		'firstChild',
		'nextSibling',
		'if ( t.nodeName === tag ) { t._kqindex = ++count; }'
	]),
	toFunc('node,a,b,cache,revs', strnthchild, [
		'tag = node.nodeName;',
		'firstElementChild',
		'nextElementSibling',
		'if ( t.nodeName === tag ) { t._kqindex = ++count; }'
	])
];

isTypeFirst = [
	toFunc( 'node', strnthpos, ['previousSibling'] ),
	toFunc( 'node', strnthpos, ['previousElementSibling'] )
];

isTypeLast = [
	toFunc( 'node', strnthpos, ['nextSibling'] ),
	toFunc( 'node', strnthpos, ['nextElementSibling'] )
];

// :first-child
query.isFirstChild = function( node ) {
	while ( node = node.previousSibling ) {
        if ( node.nodeType === 1 ) { return 0;  }
    }
    return 1;
};

// :last-child
query.isLastChild = function( node ) {
	while ( node = node.nextSibling ) {
        if ( node.nodeType === 1 ) { return 0;  }
    }
    return 1;
};

// :only-child
query.isOnlyChild = function( node ) {
	return query.isLastChild( node ) && query.isFirstChild( node );
};

query.getText = getText = function( node ) {
	var ret = '', i = 0, nodeType = node.nodeType;

	if ( nodeType === 3 || nodeType === 4 ) {
		ret += node.nodeValue;
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		for ( node = node.firstChild; node; node = node.nextSibling ) {
			ret += getText( node );
		}
	}

    return ret;
};

compile = function( expr, context ) {
	var isXML = context.isXML,
		isHTML = !isXML,
		cid = context.id,
		has = context.has,
		pris = context.finders,
		vars = context.vars,

		mfind = vars.find, mcomb = vars.comb,
		mfilter = vars.filter, mcond = vars.cond,

		vstrip = vars.strip,
		vbyTagID = has.byTagID,
		vbyChildrenTag = has.byChildrenTag,
		vpriChildren = pris['>T'],

		retesters = {
			'#': 9, '=': 9, 'N': 9,
			'[': 8, 'T': 8, '.': 5,
			'~=': 3, '|=': 3, '*=': 3,
			':not': 6, ':has': 1, ':contains': 3, ':not-ex': 7,
			':nth-child': 2, ':nth-last-child': 2,
			':first-child': 3, ':last-child': 3, ':only-child': 3
		},
		reuniques = {'#': 1, ':root': 1, '+': 1, '>': 1, '~': 1, '>T': 1},
		reclass = {'class': 1, 'className': 1},
		reprops = {'for': '${N}.htmlFor', 'class': '${N}.className'},
		reuris = {
			'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
			'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
		};

	// Clean-up selector.
	// - merge attributes/class selector etc.
	// - sort selector for filtering.
	// - figure out the fastest selector in the queue.
	function sanitize( q ) {
		var i = 0, sg, sq, scl, stp, sat, sva, t;

		for ( ; sg = q[i]; i++ ) {
			stp = sg._type;
			sat = sg[0];
			sva = sg[1];

			switch ( stp ) {
				case '=':
					if ( sva ) {
						// [name='xxx'] ===> getElementsByName('xxx')
						if ( sat === 'name' ) {
							sg = make( 'N', [sva] );
						}
						// [id='xxx'] ==> #xxx
						else if ( sat === 'id' ) {
							sg = make( '#', [sva] );
						}
						// [class='xxx'] ==> .xxx
						// [className='xxx'] ==> .xxx
						// note: XML DOCUMENT does not support getElementsByClassName
						else if ( isHTML && reclass[ sat ] ) {
							sg = make( '.', [sva] );
						}
					}
					break;
				// [class~="xxx"] ===> .xxx
				// [className~="xxx"] ===> .xxx
				case '~=':
					if ( isHTML && sva && reclass[ sat ] ) {
						sg = make( '.', [sva] );
					}
					break;
				case 'T':
					// *.class | *[xxx]
					if ( sat === '*' ) {
						sg._type = '*';
					}
					// >T
					else if ( q._union === '>' ) {
						q._tag = sg;
					}
					break;
				// :not(a b) ===> :not-ex(a b)
				case ':not':
					//TODO: Optmize selectors like 'div:not(div)', 'div:not(span)'
					//TODO: Investigate if need to optmize div:has(div) div
					if ( !((t = sat, t.length === 1) && (t = t[0], t.length === 1)) ) {
						sg._type = ':not-ex';
					}
					break;
			}

			stp = sg._type;
			// Merge .class.class2
			if ( isHTML && stp === '.' ) {
				if ( !scl ) {
					scl = sg;
				} else {
					scl.push( sg[0] );
					stp = sg._type = '*';
					q.splice( i--, 1 );
				}
			}

			sg._pri =  pris[ stp ] | 0;
			sg._tr = retesters[ stp ] | 0;

			// Figure out the fastest selector
			if ( !sq || sg._pri > sq._pri ) { sq = sg; }

			if ( stp !== '*' ) { q[i] = sg; }
		}

		return ( q.sort(order), q.$ = sq, q );
	}

	// Figure out seed selector
	function compute( token ) {
		var i = 0, q, pq, sq, fq, qu, qr, qt;

		for ( ; q = token[i]; i++ ) {
			q = sanitize( q );
			q.N = '_n' + i;
			pq = token[ i - 1 ];
			q.R = pq ? pq.N : 'root';

			if ( !sq || q.$._pri > sq._pri ) {
				sq = q.$;
				token._index = i;
			}
		}

		i = token._index === 0 ? 0 : token._index + 1;

		for ( ; q = token[i]; i++ ) {
			fq = q.$;
			qu = q._union;
			qr = fq._pri;
			qt = q._tag;

			// >T is faster
			if ( vbyChildrenTag && qu === '>' &&
				typeof( qt ) !== strundef && vpriChildren > qr ) {
				fq = q.$ = make( '>T', [qt[0]] );
				qt._type = '*';
			}
			// Combination selector is faster
			else if ( pris[ qu ] > qr ) {
				fq = q.$ = make( qu, [] );
			}

			// No priority selector, use native getElementsByTagName('*')
			if ( qr === 0 && fq._type !== '*' ) {
				fq = q.$ = make( '*', ['*'] );
				q.push( sq );
			}
		}

		// Need to verify node's parent in case kquery('#id', node)
		// node is not document
		token[0]._check = vbyTagID ? 0 : sq._type === '#';

		return token;
	}

	// Get non-normalized attributes
	function attr( name ) {
		if ( isXML ) { return '${N}.getAttribute("' + name + '")'; }

		if ( reuris[name] ) { return '${N}.getAttribute("' + name + '",2)||""'; }

		return reprops[ name ] ||
			( '(${N}.getAttribute("' + name + '")||${N}["' + name + '"])' );
	}

	function filter( q ) {
		var i = q.length, c = [], code;

		while ( i-- ) {
			if ( code = test(q[i]) ) { c.push( code ); }
		}

		return c.join( ' && ' );
	}

	function test( q ) {
		var type = q._type, val = q[0], m, a, b;

		if ( type.indexOf( '=' ) > -1 ) {
			q.A = attr( q[0] );
		}

		switch( type ) {
			case '.':
				var i = q.length, c = [];

				if ( i === 0 ) { return ''; }
				while ( i-- ) {
					c.push( 't.indexOf(" ${'+ i +'} ")!==-1' );
				}
				m = '(t=' + attr('class') + ')&&((t=" "+t+" "),(' + c.join(' && ') + '))';

				return format( m, q );
			case ':not':
				m = filter( val[0][0] );
				return m ? '!(' + m + ')' : 'false';
			case ':not-ex':
			case ':has':
				q.G = diruns++;
				break;
			case ':nth-child':
			case ':nth-last-child':
			case ':nth-of-type':
			case ':nth-last-of-type':
				if ( val === 'odd' ) {
					a = 2;
					b = 1;
				} else if ( val === 'even' ) {
					a = 2;
					b = 0;
				} else {
					m = rpos.exec( val );
					a = +(m[1] + (m[2] || 1));
					b = +m[3];
				}
				q[1] = a;
				q[2] = b;
				break;
			default:
				break;
		}

		return format( mfilter[type], q );
	}

	function then( q ) {
		var code = filter( q );

		code = code ? 'if(' + code + '){${X}}' : '';

		if ( q._check ) {
			code = format( code, {X: mcond[q._union]} );
		}

		return code ? format( code, {N: q.N} ) : '${X}';
	}

	function pass( q, term, union ) {
		return format( mcomb[ union ], {N: q.N, C: term, X: then( q )} );
	}

	// Find the seed nodes
	function find( q, seed, nq ) {
		var fq = q.$, type = fq._type, code = mfind[ type ],
			val = type === '.' ? fq.shift() : fq[0], next;

		// Skip seed selector
		if ( type !== '.' || fq.length === 0 ) {
			fq._type = '*';
			fq._orig = type;
		}

		code = format(code, {
			P: val,
			N: q.N,
			R: seed ? 'root' : q.R,
			X: then( q )
		});

		// Optimize to avoid unnecessary loop
		if ( nq && !reuniques[ type ] && !reuniques[ nq.$._type ] ) {
			next = format( vstrip, {N: q.N} );
			code = format( code, {X: next} );
		}

		return code;
	}

	// Filter descendants
	function right( token, next ) {
		var i = token._index + 1, code = '${X}',
			pq = token[ i - 1 ], lq = token[ token.length - 1 ],
			tu = vars.unique, q, sc, nc;

		for ( ; q = token[i]; i++ ) {
			sc = find( q, 0, token[i + 1] );
			code = format( code, {X: sc} );

			// Avoid duplicate node
			if ( !reuniques[ q.$._orig ] && reuniques[ pq.$._orig ] ) {
				nc = format( tu, {N: q.N} );
				code = format( code, {X: nc} );
			}

			pq = q;
		}

		nc = format( next, {N: lq.N} );
		code = format( code, {X: nc} );

		return code;
	}

	// Filter ancestors
	function left( token ) {
		var code = vars.left, i = token._index - 1, q;

		// TODO: optimize div #title
		for ( ; i > -1; i-- ) {
			q = token[ i + 1 ];
			code = format( code, {X: pass(token[i], q.N, q._union)} );
		}

		code = format( code, {X: vars.loopbreak} );
		return format( code, {R: token[0].R} );
	}

	function build( token ) {
		( diruns = 0, token = compute( token ) );

		var i = token._index,
			code = find( token[i], 1, token[i + 1] ),
			next = right( token, vars.push );

		if ( i > 0 ) {
			next = format( left(token), {Y: next} );
		}

		return format( code, {X: next} );
	}

	// Compile experssion to executable functions
	function main() {
		var fn = compile.cache( cid, expr ),
			tm, i, tokens, code, sq = [];

		if ( fn ) { return fn; }

		tokens = tokenize( expr );
		i = tokens.length;
		tm = vars.main;

		while ( i-- ) {
			var sh = {}, sv = [];

			code = build( tokens[i] );
			// Define variables at the beginning of function statement
			code = code.replace(/\/\*\^(.*?)\^\*\//g, function( m, p ) {
				return ( sh[p] || ( sh[p] = sv.push(p) ), '' );
			});
			code = format( tm, {X: sv.join('') + code + ''} );

			fn = new Function( 'query', 'context', 'return (' + code + ');' );
			sq.unshift( fn(query, context) );
		}

		if ( sq.length === 1 ) {
			return compile.cache( cid, expr, sq[0] );
		}

		return compile.cache(cid, expr, function( root, doc, context ) {
			var i = sq.length, results = [];

			while ( i-- ) {
				push_native.apply( results, sq[i](root, doc, context) );
			}

			//results = uniqueSort( results, sortOrder );
			return results;
		});
	}

	return main();
};

compile.store = {};
compile.cache = function( id, expr, value ) {
	var store = this.store[id] || (this.store[id] = createCache(25));
	return value ? store( expr, value ) : store[ expr + ' ' ];
}

function canQSA( expr, context ) {
	var selectors = context.selectors,
		cached =  selectors[ expr ], has, rqsaBugs;

	if ( typeof cached !== strundef ) { return cached; }

	has = context.has;
	rqsaBugs = has.rqsaBugs;

	if ( has.qsa && (!rqsaBugs || !rqsaBugs.test( expr.replace(rvalidator, '') )) ) {
		return ( selectors[ expr ] = 1 );
	}

	return ( selectors[ expr ] = 0 );
}

// in XML Document, querySelectorAll not works with ID/CLASS selectors.
function kquery( expr, root, seed ) {
	var match, node, context, doc, isHTML, has, m, nodeType, result = [];

	root = root || document;

	if ( !expr || typeof expr !== "string" ) {
		return [];
	}

	if ( (nodeType = root.nodeType) !== 1 && nodeType !== 9 ) {
		return [];
	}

	context = setContext( (doc = root.ownerDocument || root) );
	isHTML = !context.isXML;

	// TODO: XML document should use QSA
	if ( !seed ) {
		// Simple selector under HTML Document
		if ( isHTML && (match = rquickExpr.exec( expr )) ) {
			// Speed-up: "#ID"
			if ( (m = match[1]) ) {
				return [ context.byId( expr, root, doc ) ];
			// Speed-up: "TAG"
			} else if ( match[2] ) {
				push.apply( result, root.getElementsByTagName( expr ) );
				return result;
			// Speed-up: ".CLASS"
			} else if ( (m = match[3]) && context.has.byClass ) {
				push.apply( result, root.getElementsByClassName( m ) );
				return result;
			}
		}

		// QSA path
		if ( canQSA(expr, context) ) {
			var oid = true, nid = 'kqcache' + now(),
				newr = root, newe = nodeType === 9 && expr;

			// qSA works strangely on Element-rooted queries
			// We can work around this by specifying an extra ID on the root
			// and working up from there (Thanks to Andrew Dupont for the technique)
			// IE 8 doesn't work on object elements
			if ( isHTML && nodeType === 1 && root.nodeName.toLowerCase() !== 'object' ) {
				if ( (oid = root.getAttribute('id')) ) {
					nid = oid.replace( rescape, '\\$&' );
				} else {
					root.setAttribute( 'id', nid );
				}

				newe = newe.replace( rgroups, '#' + nid + ' $&' );
				newr = rsibling.test( expr ) && root.parentNode || root;
			}

			if ( newe ) {
				// non-standard selector exit to use js query
				try {
					push.apply( result, newr.querySelectorAll( newe ) );
					return result;
				} catch( e ) {} finally {
					if ( !oid ) { root.removeAttribute( 'id' ); }
				}
			}
		}
	}

	// All others
	return query( expr.replace( rtrim, '$1' ), root, seed, doc, context );
}

kquery.isXML = isXML;
kquery.compile = compile;

// TODO: simplify to keep only one 'match' api.
kquery.matches = function( expr, elements ) {
	return kquery( expr, null, elements );
};

kquery.match = function( node, expr ) {
	var context = setContext( node.ownerDocument || node ),
		has = context.has, matches = context.matches;

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	// rbuggyQSA always contains :focus, so no need for an existence check
	if ( matches && (!has.rmatchBugs || !has.rmatchBugs.test(expr)) &&
		!has.rqsaBugs.test(expr) ) {
		try {
			var ret = matches.call( node, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			// As well, disconnected nodes are said to be in a document
			// fragment in IE 9
			if ( ret || has.disconnectedMatch ||
					node.document && node.document.nodeType !== 11 ) {
				return ret;
			}
		} catch(e) {}
	}

	return query( expr, node, [node] ).length > 0;
};

kquery.contains = function( a, b ) {
	return setContext( a ).contains( a, b );
};

kquery.error = function( msg ) {
	throw new Error( 'SyntaxError: ' + msg );
};

setContext( document );

// Expose
if ( typeof define === "function" && define.amd ) {
	define(function() { return kquery; });
} else {
	window.kquery = kquery;
}

})( window, undefined );