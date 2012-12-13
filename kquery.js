/*
 * kquery - A Super Fast And Compatible Css3 Selector Engine.
 * Copyright (C) 2012 aaron.xiao.
 * 
 * Author: aaron.xiao <admin@veryos.com>
 * Version: 1.0
 * Created: 2011/12/10
 * Release: 2012/09/29
 * License: http://veryos.com/projects/MIT-LICENSE
 * 
 * Credits:
 * Q.js - https://github.com/hackwaly/Q
 *   - main idea of compile system
 * Sizzle.js - http://sizzlejs.org
 *   - qsa buggy detection
 *   - node sort method in browser does not support compareDocumentPosition
 */

(function( global, undefined ) {

var version = '1.0',
	document = global.document,
	docElem = document.documentElement,
	scope = global.K || ( global.K = {} ),

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
	groups = "(?=[^\\x20\\t\\r\\n\\f])(?:\\\\.|" + attributes + "|(" + identifier + "?)(" + tags + ")(?:" + pseudos + ")?|[^\\\\(),])+",
	matches = "(?:" + attributes + "(?!" + tags + "))|(" + identifier + "?)(" + tags + ")(?:" + pseudos + "(?!" + tags + "))?|(?:" + combinators + ")",

	rwhitespace = new RegExp( whitespace ),
	rtrim = new RegExp( "^" + whitespace + "+|" + whitespace + "+$", "g" ),
	rpos = /([+\-]?)(\d*)(?:n([+\-]?\d*))?/,
	rsibling = /^[\x20\t\r\n\f]*[+~]/,
	rgroups = new RegExp( groups + "?(?=" + whitespace + "*,|$)", "g" ),
	rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,
	rmatches = new RegExp( matches, "g" ),

	push = [].push,
	slice = [].slice,
	strundefined = 'undefined',
	hasDuplicate = false,
	processQuery = query,
	contains,
	sortOrder,
	siblingCheck,

	isXML = function( elem ) {
		var d = (elem ? elem.ownerDocument || elem : 0).documentElement;
		return d ? d.nodeName !== "HTML" : false;
	},
	sorter = function( a, b ) {
		return a._tr - b._tr;
	},
	create = function( arg, fn, prop ) {
		return new Function( arg, format(fn, prop) );
	},
	make = function( type, array ) {
		return ( array._type = type, array );
	},
	format = function( template, props ) {
		return template.replace(/\$\{([^\}]+)\}/g, function(m, p) {
			 return props[p] == null ? m : props[p] + '';
		});
	},
	// Used for testing something on an element
	assert = function( fn ) {
		var pass = false, div = document.createElement("div");
		try { pass = fn( div ); } catch (e) {}
		return ( div = null, pass );
	},

	// Feature/Buggy detection
	hasDocPos = !!docElem.compareDocumentPosition,
	hasByName = !!docElem.getElementsByName,
	hasByElement = 'firstElementChild' in docElem,
	hasByChildren = !!docElem.children,
	hasByTagID = assert(function( d ) {
		d.innerHTML = '<a name="d"></a><div id="d"></div>';
		return d.getElementsByTagName('*')["d"] === d.lastChild;
	}),
	hasByClass = assert(function( d ) {
		// Opera can't find the second classname (in 9.6)
		d.innerHTML = "<div class='hidden e'></div><div class='hidden'></div>";
		if ( !d.getElementsByClassName || d.getElementsByClassName("e").length === 0 ) {
			return false;
		}
		// Safari caches class attributes, doesn't catch changes (in 3.2)
		d.lastChild.className = "e";
		return d.getElementsByClassName("e").length !== 1;
	}),

	hasTextContent = 'textContent' in docElem,
	hasElementPos = hasByElement && hasDocPos,
	hasChildrenTag = hasByChildren && !!docElem.children.tags,
	// Native hasAttribute method
	hasNativeAttr = docElem.hasAttribute &&
		docElem.hasAttribute.toString &&
		docElem.hasAttribute.toString().indexOf('[native code]') !== -1,
	hasTagComment = assert(function( d ) {
		d.appendChild( document.createComment("") );
		return d.getElementsByTagName("*").length !== 0;
	}),
	// Buggy of getElementById and getElementsByName
	hasNameMixID = assert(function( d ) {
		var hash = 'id' + (new Date().getTime()),
			pass;

		div.id = hash + 0;
		div.innerHTML = "<a name='" + hash + "'></a><div name='" + hash + "'></div>";
		docElem.insertBefore( div, docElem.firstChild );

		hasByName = hasByName &&
		// buggy browsers will return fewer than the correct 2
		document.getElementsByName( hash ).length ===
		// buggy browsers will return more than the correct 0
		2 + document.getElementsByName( hash + 0 ).length;
		pass = !document.getElementById( hash );

		return ( docElem.removeChild( div ), pass );

	});

try {
	slice.call( docElem.childNodes, 0 )[0].nodeType;
} catch( e ) {
	slice = function( i ) {
		var results = [],
			elem;

		for ( ; (elem = this[i]); i++ ) {
			results.push( elem );
		}

		return results;
	};
}

if ( hasDocPos ) {
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		return ( !a.compareDocumentPosition || !b.compareDocumentPosition ?
			a.compareDocumentPosition :
			a.compareDocumentPosition(b) & 4
		) ? -1 : 1;
	};
} else {
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var al, bl,
			ap = [],
			bp = [],
			aup = a.parentNode,
			bup = b.parentNode,
			cur = aup;

		// If the nodes are siblings (or identical) we can do a quick check
		if ( aup === bup ) {
			return siblingCheck( a, b );
		// If no parents were found then the nodes are disconnected
		} else if ( !aup ) {
			return -1;
		} else if ( !bup ) {
			return 1;
		}

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
		for ( var i = 0; i < al && i < bl; i++ ) {
			if ( ap[i] !== bp[i] ) {
				return siblingCheck( ap[i], bp[i] );
			}
		}

		// We ended someplace up the tree so do a sibling check
		return i === al ?
			siblingCheck( a, bp[i], -1 ) :
			siblingCheck( ap[i], b, 1 );
	};

	siblingCheck = function( a, b, ret ) {
		if ( a === b ) {
			return ret;
		}

		var cur = a.nextSibling;

		while ( cur ) {
			if ( cur === b ) {
				return -1;
			}

			cur = cur.nextSibling;
		}

		return 1;
	};
}

// API
function kquery( expr, ctx, seed ) {
	ctx = ctx || document;

	var match, elem, xml, m,
		nodeType = ctx.nodeType;

	if ( (nodeType !== 1 && nodeType !== 9) || !expr || typeof expr !== "string" ) {
		return [];
	}

	xml = isXML( ctx );

	if ( !xml && !seed ) {
		if ( (match = rquickExpr.exec(expr)) ) {
			// Speed-up: #id
			if ( (m = match[1]) ) {
				if ( nodeType === 9 ) {
					elem = ctx.getElementById( m );

					if ( elem && elem.parentNode ) {
						if ( elem.id === m ) {
							return [ elem ];
						}
					} else {
						return [];
					}
				} else {
					// Context is not a document
					if ( ctx.ownerDocument &&
						(elem = ctx.ownerDocument.getElementById( m )) &&
						contains( ctx, elem ) && elem.id === m ) {
						return [ elem ];
					}
				}
			}
			// Speed-up: TAG
			else if ( match[2] ) {
				return slice.call( ctx.getElementsByTagName(expr), 0 );
			// Speed-up: .CLASS
			} else if ( (m = match[3]) && hasByClass && ctx.getElementsByClassName ) {
				return slice.call( ctx.getElementsByClassName(m), 0 );
			}
		}
	}

	return processQuery( expr, ctx, seed, xml );
};

// Document sorting and removing duplicates
kquery.uniqueSort = function( results ) {
	var elem, i = 1;

	if ( sortOrder ) {
		results.sort( sortOrder );

		if ( hasDuplicate ) {
			for ( ; (elem = results[i]); i++ ) {
				if ( elem === results[ i - 1 ] ) {
					results.splice( i--, 1 );
				}
			}
			hasDuplicate = false;
		}
	}

	return results;
};

if ( docElem.sourceIndex ) {
	kquery.uniqueSort = function( results ) {
		var rets = [], sets = [], hash = {},
			i = 0, len = results.length,
			j = 0, node, index;

		for ( ; i < len; i++ ) {
		    node = results[ i ];
		    index = node.sourceIndex + 1e8;
		
		    if ( !hash[index] ) {
		        ( sets[j++] = new String(index) )._ = node;
		        hash[ index ] = 1;
		    }
		}

		sets.sort();
		while( j ) {
			rets[--j] = sets[j]._;
		}

		return rets;
	};
}

contains = kquery.contains = hasDocPos ? function( a, b ) {
	return !!(a.compareDocumentPosition(b) & 16);
} : docElem.contains ? function( a, b ) {
    return a !== b && (a.contains ? a.contains(b) : true);
} : function( a, b ) {
	while ( (b = b.parentNode) ) {
		if ( a === b ) return true;
	}
	return false;
};

kquery.version = version;
kquery.compile = compile;

kquery.matches = function ( expr, elements ) {
    return kquery( expr, null, null, elements );
};

kquery.matchesSelector = function( elem, expr ) {
	return kquery( expr, null, null, [ elem ] ).length > 0;
};

kquery.error = function( msg ) {
	throw new Error( 'SyntaxError: ' + msg );
};

kquery.setup = function( unique ) {
	finders['#'] = unique ? 9 : 0;
};

var chainPos = 0,
	// Cache compiled expression
	cacheQueries = {},
	// Maximize of each cache item
	cacheNumber = 25,
	// Priority of seed selector
	finders = {
		':root': 10, '+': 10, '#': 0,
		'>T': hasChildrenTag ? 8 : 0,
		'N': hasByName ? 7 : 0,
		'.': hasByClass ? 6 : 0,
		'>': 6, '~': 6, 'T': 5,
		':checked': 4, ':enabled': 4, ':disabled': 4,
		':link': 3, ':visited': 3,
		'*': 0
	},
	// Priority of testing condition selector
	testers = {
		'#': 9, '=': 9, 'N': 9,
		'[': 8, 'T': 8, '.': 5,
		'~=': 3, '|=': 3, '*=': 3,
		':not': 6, ':has': 1, ':contains': 3, ':not-ex': 7,
		':nth-child': 2, ':nth-last-child': 2,
		':first-child': 3, ':last-child': 3, ':only-child': 3
	},

	elements = {
		':root': 1, ':nth-child': 1, ':nth-last-child': 1, ':nth-of-type': 1,
		':nth-last-of-type': 1, ':first-child': 1, ':last-child': 1,
		':first-of-type': 1, ':last-of-type': 1, ':only-child': 1,
		':only-of-type': 1, ':empty': 1, ':link': 1, ':visited': 1, ':active': 1,
		':hover': 1, ':focus': 1, ':target': 1, ':lang': 1, ':enabled': 1,
		':disabled': 1, ':checked': 1, ':not': 1,
		'T': 1, '#': 1, 'N': 1, '.': 1,
		'*': hasTagComment ? 0 : 1,
		'+': hasByElement ? 1 : 0,
		'~': hasByElement ? 1 : 0
	},
	// Selectors which returns non-duplicate results
	uniqueness = {
		'#': 1, ':root': 1, '+': 1, '>': 1, '~': 1, '>T': 1
	},

	classname = {
		'class': 1, 'className': 1
	},

	uridata = {
		'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
		'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
	},

	pseudos = {
		':root': 1, ':nth-child': 2, ':nth-last-child': 2, ':nth-of-type': 2,
		':nth-last-of-type': 2, ':first-child': 1, ':last-child': 1,
		':first-of-type': 1, ':last-of-type': 1, ':only-child': 1,
		':only-of-type': 1, ':empty': 1, ':link': 1, ':visited': 1, ':active': 1,
		':hover': 1, ':focus': 1, ':target': 1, ':lang': 2, ':enabled': 1,
		':disabled': 1, ':checked': 1, '::first-line': 1, '::first-letter': 1,
		'::before': 1, '::after': 1, ':not': 2
	},

	pseudos_ex = {},

	// Compiler templates
	tpldoc = '/*^var doc=root.ownerDocument||root;^*/',
	tplmain = 'function(root, xml){var result=[];var done=query.veroset,t,l=result.length;BQ:{${X}}query.veroset=done;return result;}',
	tplveroset = '${N}.veroset||(${N}.veroset=++done)',
	tplpush = 'result[l++]=${N};',
	tplleft = 'var ${R}V={_:false};NP_${R}:{P_${R}:{${X}break NP_${R};}${R}V._=true;${Y}}',
	tplcontains = hasDocPos ?
		'${0}.compareDocumentPosition(${1})&16' : '${0}.contains(${1})',
	tplhelp = '/*^var ${N}l;^*/if(!${N}l||!(' + format( tplcontains, ['${N}l', '${N}'] ) +')){${X}${N}l=${N};}',
	tplunique = '/*^var ${N}h={};^*/if(${N}h[' + tplveroset + ']){break;}${N}h[' + tplveroset + ']=1;${X}',
	tpllink = '/*^var tag_a=xml?"a":"A";^*/',

	// Loop blocks
	tplpass = 'if(t=${N}h[' + tplveroset + ']){if(t._){break P_${R};}else{break NP_${R};}}${N}h[' + tplveroset + ']=${R}V;${X}',
	tplpassed = 'break P_${R};',
	tplpassing = format( tplpass, {X: 'if(${N}!==${R}){${X}}'} ),
	tplpasscombs = {
		'>': '/*^var ${N}h={};^*/var ${N}=${C}.parentNode;' + tplpassing,
		' ': '/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.parentNode){' + tplpassing + '}',
		'+': hasByElement ?
			'/*^var ${N}h={};var ${N};^*/if(${N}=${C}.previousElementSibling){${X}}' :
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){${X}break;}}',
		'~': hasByElement ?
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousElementSibling){' + tplpass + '}' :
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){' + tplpass + '}}'
	},

	tplfind = {
		'#': tpldoc + 'var ${N}=query._byId("${P}",${R});if(${N}){${X}}',
		'N': tpldoc + 'var ${N}a=doc.getElementsByName("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){if(${R}===doc||' + format( tplcontains, ['${R}', '${N}'] ) +'){${X}}}',
		'T': 'var ${N}a=${R}.getElementsByTagName("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'.': 'var ${N}a=${R}.getElementsByClassName("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'*': 'var ${N}a=${R}.getElementsByTagName("*");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'[': 'var ${N}a=${R}.getElementsByTagName("*");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'+': hasByElement ? '/*^var ${N};^*/if(${N}=${R}.nextElementSibling){${X}}' : 
			 'var ${N}=${R};while(${N}=${N}.nextSibling){if(${N}.nodeType===1){${X}break;}}',
		'~': hasByElement ?
			'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextElementSibling){if(${N}h[' + tplveroset + '])break;${N}h[' + tplveroset + ']=1;${X}}' :
			'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextSibling){if(${N}.nodeType===1){if(${N}h[' + tplveroset + '])break;${N}h[' + tplveroset + ']=1;${X}}}',
		'>': 'var ${N}a=${R}.children||${R}.childNodes;for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'>T': 'var ${N}a=${R}.children.tags("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		':root': tpldoc + 'var ${N}a=[doc.documentElement];for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		':link': 'var ${N}a=${R}.getElementsByTagName("a");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		':visited': 'var ${N}a=${R}.getElementsByTagName("a");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		':checked': 'var ${N}a=${R}.getElementsByTagName("input");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		':enabled': tpldoc + 'var ${N}a=query("input,select,textarea,option",doc,null,xml);for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){if(${N}.disabled===false){${X}}}',
		':disabled': tpldoc + 'var ${N}a=query("input,select,textarea,option",doc,null,xml);for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){if(${N}.disabled===true){${X}}}'
	},

	tplradix = {
		'+': hasByElement ?
			'if(${N}.previousElementSibling===root){${X}}' :
			'var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){break}}if(${N}===root){${X}}',
		'~': hasByElement ?
			'if(root.compareDocumentPosition(${N})&4){${X}}' :
			'if((root!=${N}&&root.contains(${N})&&16 )+(root!=${N}&&${N}.contains(root)&&8)+(root.nodeType===1?(root.sourceIndex<${N}.sourceIndex&&4)+(root.sourceIndex>${N}.sourceIndex&&2):1)&4){${X}}',
		'>': 'if(${N}.parentNode===root){${X}}'
	},

	tpltest = {
		'T': '/*^var ${N}t=xml?"${0}":("${0}").toUpperCase();^*/${N}.nodeName===${N}t',
		'#': '${N}.id==="${0}"',
		'N': '${N}.name==="${0}"',
		'[': hasNativeAttr ?
			'${N}.hasAttribute("${0}")' :
			'(t=${N}.getAttributeNode("${0}"))&&(t.specified)',
		'=': '${A}==="${1}"',
		'!=': '${A}!=="${1}"',
		'^=': '(t=${A})&&t.indexOf("${1}")===0',
		'$=': '(t=${A})&&t.indexOf("${1}")===(t.length - "${1}".length)',
		'*=': '(t=${A})&&t.indexOf("${1}")!==-1',
		'|=': '(t=${A})&&t.indexOf("-${1}-")!==-1',
		'~=': '(t=${A})&&(" "+t+" ").indexOf("${1}")!==-1',

		':nth-child': '/*^var rev=query.verocache;^*/query._nth(${N},${1},${2},rev)',
		':nth-last-child': '/*^var rev=query.verocache;^*/query._nth(${N},${1},${2},rev,true)',
		':nth-of-type': '/*^var rev=query.verocache;^*/query._type(${N},${1},${2},rev)',
		':nth-last-of-type': '/*^var rev=query.verocache;^*/query._type(${N},${1},${2},rev,true)',
		':first-child': hasByElement ?
			'!${N}.previousElementSibling' : 'query._first(${N})',
		':last-child': hasByElement ?
			'!${N}.nextElementSibling' : 'query._last(${N})',
		':first-of-type': 'query._firstType(${N})',
		':last-of-type': 'query._lastType(${N})',
		':only-child': hasByElement ?
			'(t=${N}.parentNode)&&(t.firstElementChild===t.lastElementChild)' :
			'query._only(${N})',
		':only-of-type': 'query._onlyType(${N})',

		':root': '${N}===doc.documentElement',
		':empty': '!${N}.firstChild',
		':lang': '${N}.lang==="${0}"',

		// FIXME: investigation :visited
		':link': tpllink + '${N}.nodeName===tag_a',
		':visited': 'false',
		':hover': tpldoc + '${N}===doc.hoverElement',

		':active': tpldoc + '${N}===doc.activeElement',
		':focus': tpldoc + '${N}===doc.activeElement&&(!doc.hasFocus||doc.hasFocus())&&!!(${N}.type||${N}.href)',
		':target': tpldoc + '${N}.id&&doc.location.hash.slice(1)===${N}.id',

		':enabled': '${N}.disabled===false',
		':disabled': '${N}.disabled===true',
		':checked': '${N}.checked===true',

		// Does not match a real document element
		'::first-line': 'false',
		'::first-letter': 'false',
		'::before': 'false',
		'::after': 'false',
		// Dynamically generate in filter
		':not': ''
	},

	strprev = hasByElement ? 'previousElementSibling' : 'previousSibling',
	strnext = hasByElement ? 'nextElementSibling' : 'nextSibling',
	strfirst = hasByElement ? 'firstElementChild' : 'firstChild',
	strelement = hasByElement ? 'node.nodeName===name' : 'node.nodeType===1&&node.nodeName===name',
	strmarges = 'while ( node = node.${0} ) {' 
		+ 'if ( node.nodeType === 1 ) {return false;}' 
		+ '}return true;',
	strchild = 'var name = node.nodeName;' 
		+ 'while ( node=node.${0} ) { ' 
		+ 'if ( ' + strelement + ' ) {return false;}' 
		+ '}return true;',
	strsibling = 'var p = node.parentNode, count = 0, pos, t;${0}' 
		+ 'if ( a === 1 && b === 0 ) {' 
		+ 'return true;' 
		+ '} else if ( a === 0 && b === 0 ) {' 
		+ 'return false;}' 
		+ 'if ( p && (p.verocache !== cache || !node.veroindex) ) {' 
		+ 'for ( t = p.' + strfirst + '; t; t = t.' + strnext + ' ) {' 
		+ '${1}' 
		+ '}p.verocache = cache;p.verocount = count;}' 
		+ 'pos = end ? p.verocount - node.veroindex + 1 : node.veroindex;' 
		+ 'return a ? (pos - b) % a === 0 : pos === b;';

// Compile selector experssion to executable function
function compile( expr, xml ) {
	var group = parse( expr ),
		len = group.length;

	while ( len-- ) {
		var chain  = group[ len ],
			code = build( chain, xml );

		var hash = {},
			pres = [],
			posts = [];

		// Define variables at the beginning of function statement
		code = code.replace(/\/\*\^(.*?)\^\*\//g, function ( m, p ) {
			return ( hash[p] || (hash[p] = pres.push(p)), '' );
		});

		code = code.replace(/\/\*\$(.*?)\$\*\//g, function ( m, p ) {
			return ( hash[p] || (hash[p] = posts.push(p)), '' );
		});

		code = format( tplmain, {X: pres.join('') + code + posts.join('')} );
		group[len] = new Function('query', 'return(' + code + ')')(query);
	}

	if ( group.length === 1 ) {
        return group[0];
    }

	return function ( ctx ) {
    	var len = group.length,
    		ret = [];

		while ( len-- ) {
			push.apply( ret, group[len](ctx) );
		}

		return ret;
		//return kquery.uniqueSort( ret );
    }
}

// Parse selector to internal format
var parse = function() {
	var text, index;

	function error() {
		return kquery.error( [text,  "character: " + index].join(', ') );
	}

	function match( regex ) {
		var mc = ( regex.lastIndex = index, regex.exec(text) );
		return mc && mc.index == index ? (index = regex.lastIndex, mc) : null;
	}

	function parse() {
		var m, q = [], c = [q], g = [c], t;

		while ( (m = match(rmatches)) !== null ) {
			// [ ~+>,] group or combination selector
			if ( m[8] ) {
				if ( m[8] === "," ) {
					// Selector starts with ','
					c.length === 1 && q.length === 0 && error();
					g.push( c = [ q = [] ] );
				} else {
					// Invalid combination  div + + div
					q.length === 0 && q._union && error();
					c.length === 1 && q.length && ( q._union = q._union || " " );
					( c.length > 1 || c.length === 1 && q.length ) && c.push( q = [] );
					q._union = m[8].replace( /\s/g, " " );
				}
			}
			// Attribute selector [attr='xxx']
			else if ( m[1] ) {
				// [attr='xxx']
				if ( m[2] && typeof( m[4] ) !== strundefined ) {
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
						t = m[5] + m[6];

						if ( m[7] ) {
							if ( m[6] === 'not' || m[6] === 'has' ) {
								var _i = index, _t = text;
								(index = 0, text = text.slice(_i - m[7].length - 1, _i - 1));
								q.push( make(t, [parse(), text]) );
								( index = _i + 1, text = _t );
							} else {
								q.push( make(t, [m[7]]) );
							}
						} else {
							q.push( make(t, m[5] === '::' ? [t] : [m[6]]) );
						}
					}
				} else {
					q.push( make("T", [m[6]]) );
				}
			}
		}

		return g;
	}

	return function( selector ) {
		( text = selector, index = 0, selector = parse() );
		return ( match(/\s*/g), index < text.length ) ? error() : selector;
	};
}();

// Clean-up selector
// 1. merge attributes/class selector etc.
// 2. sort selector order for testing.
// 3. get the fast selector
function clean( q, xml ) {
	var i = 0, s, t, f, classes;

	for ( ; s = q[i]; i++ ) {
		switch ( s._type ) {
			case '=':
				if ( s[1] ) {
					// [name='xxx'] ===> getElementsByName('xxx')
					if ( s[0] === 'name' ) {
						s = make( 'N', [s[1]] );
					}
					// [id='xxx'] ==> #xxx
					else if ( s[0] === 'id' ) {
						s = make( '#', [s[1]] );
					}
					// [class='xxx'] ==> .xxx
					// [className='xxx'] ==> .xxx
					// note: XML DOCUMENT does not support getElementsByClassName
					else if ( !xml && classname[ s[0] ] ) {
						s = make( '.', [s[1]] );
					}
				}
				break;
			// [class~="xxx"] ===> .xxx
			// [className~="xxx"] ===> .xxx
			case '~=':
				if ( !xml && s[1] && classname[ s[0] ] ) {
					s = make( '.', [s[1]] );
				}
				break;
			case 'T':
				// *.class | *[xxx]
				if ( s[0] === '*' ) {
					s._type = '*';
				}
				// >T
				else if ( q._union == '>' ) {
					q._tag = s;
				}
				break;
			// :not(a b) ===> :not-ex(a b)
			case ':not':
				if ( !((t=s[0], t.length === 1) && (t=t[0], t.length === 1)) ) {
					s._type = ':not-ex';
				}
				break;
		}

		// Merge .class.class2
		if ( !xml && s._type === '.' ) {
			if ( !classes ) {
				classes = s;
			} else {
				classes.push( s[0] );
				s._type = '*';
				q.splice( i--, 1 );
			}
		}

		s._pri =  finders[ s._type ] | 0;
		s._tr = testers[ s._type ] | 0;

		// Find the fast selector for sorting and testing
		if ( !f || s._pri > f._pri ) {
			f = s;
		}

		if ( s._type !== '*' ) {
			q[i] = s;
		}
	}

	return ( q.sort( sorter ), q.$ = f, q );
}

// Compute and clean-up to find the fastest seed selector in the chain
function compute( chain, xml ) {
	var i = 0,
		len = chain.length,
		seq, part, seed;

	for ( ; i < len; i++ ) {
		seq = chain[i];
		seq = clean( seq, xml );
		seq.N = '_n' + i;
		part = chain[ i - 1 ];
		seq.R = part ? part.N : 'root';

		if ( !seed || seq.$._pri > seed._pri ) {
			seed = seq.$;
			chain._index = i;
		}
	}

	i = chain._index === 0 ? 0 : chain._index + 1;

	for ( ; i < len; i++ ) {
		seq = chain[i];
		seed = seq.$;

		// >T is faster
		if ( hasChildrenTag && seq._union === '>' && 
			typeof( seq._tag ) !== strundefined && finders['>T'] > seed._pri ) {
			seed = seq.$ = make( '>T', [seq._tag[0]] );
			seq._tag._type = '*';
		}
		// Combination selector is faster
		else if ( finders[ seq._union ] > seed._pri ) {
			seed = seq.$ = make( seq._union, [] );
		}

		// No priority selector, use native getElementsByTagName('*')
		if ( seed._pri === 0 && seed._type !== '*' ) {
			seed = seq.$ = make( '*', ['*'] );
			seq.push( seed );
		}
	}

	// Check root node in case query('#id', root), root is document.
	// It is not sure whether element#id is the root's descendant.
	// Must verify the root element.
	if ( !hasByTagID ) {
		chain[0]._check = chain[ chain._index ].$._type === '#';
	}

	return chain;
}

function build( chain, xml ) {
	chainPos = 0;
	chain = compute( chain, xml );

	var index = chain._index,
		seed = chain[ index ],
		code = find( seed, 1, xml );

	var	next = right( chain, tplpush, xml ),
		prev;
	
	if ( index > 0 ) {
		prev = left( chain, xml );
		next = format( prev, {Y: next} );
	}

	return ( code = format(code, {X: next}), format('${X}', {X: code}) );
}

// Find the seed nodes
function find( q, seed, xml ) {
	var sc = q.$,
		type = sc._type,
		code = tplfind[ type ],
		val = type === '.' ? sc.shift() : sc[0];

	if ( !q._tag && !elements[ type ] ) {
		q.push( make(':element', []) );
	}

	// Skip seed selector
	if ( type !== '.' || sc.length === 0 ) {
		sc._type = '*';
	}

	return format(code, {
		P: val,
		N: q.N,
		R: seed ? 'root' : q.R,
		X: then( q, xml )
	});
}

// Filter descendants
function right( chain, then, xml ) {
	var index = chain._index,
		i = index + 1,
		len = chain.length,
		code = '${X}',
		seed = chain[ index ],
		last = chain[ chain.length - 1 ],
		type, part, next;

	for ( ; i < len; i++ ) {
		part = chain[i];
		type = part.$._type;

		if ( !uniqueness[type] ) {
			next = format( tplhelp, {N: seed.N} );
			code = format( code, {X: next} );
		}

		code = format( code, {X: find( part, 0, xml )} );
		seed = part;
	}

	if ( part && !uniqueness[type] ) {
		code = format( code, {X: tplunique} );
		code = format( code, {N: part.N} );
	}

	next = format( then, {N: last.N} );
	code = format( code, {X: next} );

	return code;
}

// Filter ancestors
function left( chain, xml ) {
	var code = tplleft, i = chain._index - 1, q, last;

	for ( ; i > -1; i-- ) {
		q = chain[ i ];
		last = chain[ i+1 ];
		code = format( code, {X: pass(q, last.N, last._union, xml)} );
	}

	code = format( code, {X: tplpassed} );
	code = format( code, {R: chain[0].R} );

	return code;
}

function pass( q, term, union, xml ) {
	return format(tplpasscombs[union], {
		N: q.N,
		C: term,
		X: then( q, xml )
	});
}

function then( q, xml ) {
	var code = filter( q, xml );

	code = code ? 'if(' + code + '){${X}}' : '';

	if ( q._check ) {
		code = format( code, {X: tplradix[q._union]} );
	}

	return code ? format(code, { N: q.N }) : '${X}';
}

function filter( q, xml ) {
	var s = [],
		k = q.length,
		m, code;

	while ( k-- ) {
		m = q[k];
		if ( code = test( m, xml ) ) {
			s.push( code );
		}
	}

	return s.join( ' && ' );
}

// Check attributes
function test( m, xml ) {
	var t;

	if ( m._type.indexOf( '=' ) > -1 ) {
		m.A = attr( m[0], xml );
	}

	switch( m._type ) {
		case '.':
			var k = m.length,
				s = [];

			if ( k === 0 ) {
				return '';
			}

			while ( k-- ) {
				s.push( 't.indexOf(" ${'+ k +'} ")!==-1' );
			}

			t = '(t=' + attr('class', xml) + ')&&((t=" "+t+" "),(' + s.join(' && ') + '))';

			return format( t, m );
		case ':not':
			t = filter( m[0][0][0], xml );
			return t ? '!(' + t + ')' : 'false';
		case ':not-ex':
		case ':has':
			m.G = chainPos++;
			break;
		case ':nth-child':
		case ':nth-last-child':
		case ':nth-of-type':
		case ':nth-last-of-type':
			m[0] = m[0] === 'even' ? '2n' : (m[0] === 'odd' ? '2n+1' : m[0]);
			t = rpos.exec( m[0] );
			m[1] = (t[1] + (t[2] || 1)) - 0;
			m[2] = t[3] - 0;
			break;
		case '*':
			return '';
		default:
			break;
	}

	return format( tpltest[m._type], m );
}

// Get non-normalized attributes
function attr( name, xml ) {
	if ( xml ) {
		return '${N}.getAttribute("' + name + '")'
	}

	if ( uridata[name] ) {
		return '${N}.getAttribute("' + name + '",2)||""';
	}

	switch ( name ) {
		case 'for':
			return '${N}.htmlFor';
		case 'class':
			return '${N}.className';
		default:
			return '(${N}.getAttribute("' + name + '")||${N}["' + name + '"])';
	}
}

function getQuery( expr, xml ) {
	var index = ( xml ? 2 : 0 ) + ( finders['#'] === 9 ? 0 : 1 ),
		cache = cacheQueries[ index ],
		query, keys;

	if ( !cache ) {
		cache = cacheQueries[ index ] = {};
		cache['<keys>'] = [];
	}

	query = cache[ expr ];
	keys = cache[ '<keys>' ];

	if ( !query ) {
		if ( keys.push(expr) > cacheNumber ) {
			delete cache[ keys.shift() ];
		}
		query = cache[expr] = compile( expr, xml );
	}

	return query;
}

function query( expr, ctx, seed, xml ) {
	query.verocache = query.verocache + 1;
	finders['.'] = xml ? 0 : ( hasByClass ? 6 : 0 );

	var process = getQuery( expr, xml ),
		ret = process( ctx, xml );

    if ( seed ) {
        ret = query._in( seed, ret );
    }

	return ret;
}

query.veroset = 1;
query.verocache = 0;
query.isXML = isXML;

query._byId = function( id, ctx ) {
	var m = document.getElementById( id );
	return m && m.parentNode ? m : null;
};

// Support element.getElementById
if ( hasByTagID ) {
	query._byId = function( id, ctx ) {
		return ctx.getElementsByTagName('*')[id];
	};
}

if ( hasNameMixID ) {
	query._byId = function( id, ctx ) {
		var doc = ctx.ownerDocument || ctx,
			m = doc.getElementById( id );

		return m && m.parentNode ?
			( ctx.nodeType === 1 && contains(ctx, m) ) && m.id === id ||
			typeof m.getAttributeNode !== strundefined &&
			m.getAttributeNode("id").value === id ?
				m :
				null :
			null;
	};
}

query._hash = function ( rs ) {
    var vh = rs.verohash;

    if ( !vh ) {
        var k = rs.length,
        	done = query.veroset;

        vh = rs.verohash = {};

        while ( k-- ) {
            var it = rs[k];
            vh[ it.veroset || (it.veroset = ++done) ] = 1;
        }

        query.veroset = done;
    }

    return vh;
};

query._in = function ( nodes, sets ) {
    var vh = query._hash( sets ),
    	ret = [],
    	i = 0, node;

    for ( ; i < nodes.length; i++ ) {
        node = nodes[i];
        if ( vh[node.veroset || (node.veroset = ++query.veroset)] ) {
            ret.push( node );
        }
    }

	return ret;
};

// :nth-child(xxxx) :ntn-last-child(xxx)
query._nth = create( 'node, a, b, cache, end', strsibling, [
	'', hasByElement ? 
		't.veroindex = ++count;' : 
		'if ( t.nodeType === 1 ) {t.veroindex = ++count;}'
]);

// :nth-of-type(xxx) :nth-last-of-type(xxx)
query._type = create( 'node, a, b, cache, end', strsibling, [
	'var name = node.nodeName;',
	'if ( t.nodeName === name ) {t.veroindex = ++count;}'
]);

// :first-child
query._first = create( 'node', strmarges, [strprev] );

// :last-child
query._last = create( 'node', strmarges, [strnext] );

// :only-child
query._only = function( node ) {
	return query._last( node ) && query._first( node );
};

// :first-of-type
query._firstType = create( 'node', strchild, [strprev] );

// :last-of-type
query._lastType = create( 'node', strchild, [strnext] );

// :only-of-type
query._onlyType = function ( node ) {
	return query._lastType( node ) && query._firstType( node );
};

// Extend pseudo selector
kquery.pseudoExtend = function( items ) {
	var item, name,
		text, perm;

	for ( name in items ) {
		item = items[name];

		if ( !name || !item || (name in pseudos) || (pseudos_ex[name] || 0) > 2 ) {
			continue;
		}

		text = item.text;
		perm = Number( item.perm ) || 0;
		pseudos_ex[name] = 1 + perm;
		tpltest[name] = item.text;
	}
};

// Necessary internal extension of pseudos
kquery.pseudoExtend({
	':not-ex': {
		text: '/*^var _${G}=query._hash(query("${1}",root));done=query.veroset;^*/'
			+ '!_${G}[' + tplveroset + ']',
		perm: 3
	},
	':element': {
		text: '${N}.nodeType===1',
		perm: 2
	},
	':has': {
		text: '(t=query("${1}", ${N}),done=query.veroset,t.length>0)',
		perm: 3
	},
	':contains': {
		text: (hasTextContent ? '${N}.textContent' : '${N}.innerText')
			+ '.indexOf("${0}")>-1',
		perm: 3
	}
});

// From Sizzle
// handle qsa bugs
if ( document.querySelectorAll ) {
	(function() {
		var strpseudo,
			disconnectedMatch,
			div = document.createElement('div'),
			rescape = /'|\\/g,
			rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,
			rbuggyQSA = [
				':contains',
				':not-ex',
				"(?:\\[" + whitespace + "*(" + encoding + "+)" + whitespace
				+ "*(?:(!=)" + whitespace + "*(?:(['\"])?((?:\\\\.|[^\\\\])*?)\\3))"
				+ whitespace + "*\\])"
			],
			rbuggyMatches = [':active'],
			matches = docElem.matchesSelector ||
				docElem.mozMatchesSelector ||
				docElem.webkitMatchesSelector ||
				docElem.oMatchesSelector ||
				docElem.msMatchesSelector;

		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( div ) {
			div.innerHTML = "<select><option selected></option></select>";

			// IE8 - Some boolean attributes are not treated correctly
			if ( !div.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:checked|disabled|ismap|multiple|readonly|selected|value)" );
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here (do not put tests after this one)
			if ( !div.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}
		});

		assert(function( div ) {
			// Opera 10-12/IE9 - ^= $= *= and empty values
			// Should not select anything
			div.innerHTML = "<p test=''></p>";
			if ( div.querySelectorAll("[test^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:\"\"|'')" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements are still enabled
			// IE8 throws error here (do not put tests after this one)
			div.innerHTML = "<input type='hidden'>";
			if ( !div.querySelectorAll(":enabled").length ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}
		});

		for ( strpseudo in pseudos ) {
			try {
				document.querySelectorAll( strpseudo );
			} catch (e) {
				rbuggyQSA.push( strpseudo );
			}
		}

		rbuggyQSA = new RegExp( rbuggyQSA.join('|') );

		processQuery = function( expr, ctx, seed, xml ) {
			if ( !seed && !xml && (!rbuggyQSA || !rbuggyQSA.test(expr)) ) {
				if ( ctx.nodeType === 9 ) {
					return slice.call( ctx.querySelectorAll(expr), 0 );
				}
				// qSA works strangely on Element-rooted queries
				// IE 8 doesn't work on object elements
				else if ( ctx.nodeType === 1 &&
					ctx.nodeName.toLowerCase() !== "object" ) {
					var old = ctx.getAttribute( "id" ),
						nid = old || ( 'verocache' + jsQuery.verocache ),
						_ctx = rsibling.test(expr) && ctx.parentNode || ctx,
						_expr;

					if ( old ) {
						nid = nid.replace( rescape, "\\$&" );
					} else {
						ctx.setAttribute( "id", nid );
					}

					try {
						_expr = expr.replace( rtrim, "" );
						_expr = _expr.replace( rgroups, "[id='" + nid + "'] $&" );
						return slice.call( _ctx.querySelectorAll(_expr), 0 );
					} catch ( e ) {} finally {
						if ( !old ) {
							ctx.removeAttribute( "id" );
						}
					}
				}
			}

			return query( expr, ctx, seed, xml );
		};

		if ( matches ) {
			assert(function( div ) {
				// Check to see if it's possible to do matchesSelector
				// on a disconnected node (IE 9)
				disconnectedMatch = matches.call( div, "div" );

				// This should fail with an exception
				// Gecko does not error, returns false instead
				try {
					matches.call( div, "[test!='']:sizzle" );
					rbuggyMatches.push( '' );
				} catch ( e ) {}
			});

			rbuggyMatches = new RegExp( rbuggyMatches.join("|") );

			kquery.matchesSelector = function( elem, expr ) {
				expr = expr.replace( rattributeQuotes, "='$1']" );

				if ( !isXML(elem) && !rbuggyMatches.test(expr) &&
					(!rbuggyQSA || !rbuggyQSA.test(expr)) ) {
					try {
						var ret = matches.call( elem, expr );

						// IE 9's matchesSelector returns false on disconnected nodes
						// As well, disconnected nodes are said to be in a document
						// fragment in IE 9
						if ( ret || disconnectedMatch || 
							elem.document && elem.document.nodeType !== 11 ) {
							return ret;
						}
					} catch(e) {}
				}

				return kquery( expr, null, [elem] ).length > 0;
			};
		}
	})();
}

// Expose api
scope.query = kquery;

})( this );