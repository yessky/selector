/*
 * Super Fast and Compatible CSS Selector Engine
 * Copyright (C) 2011 - 2013 aaron.xiao
 * Author: aaron.xiao <admin@veryos.com>
 * Version: 2.0b
 * Release: 2013/08/17
 * License: http://selector.veryos.com/MIT-LICENSE
 * Credits: 
 * Sizzle.js - http://sizzlejs.org
 *   - buggy detection
 */

(function( window, undefined ) {

var version = '2.0.build',
	document = window.document,
	strundef = typeof undefined,
	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = '[\\x20\\t\\r\\n\\f]',
	// http://www.w3.org/TR/css3-syntax/#characters
	encoding = '(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+',
	// CSS identifier characters
	identifier = encoding.replace( 'w', 'w#' ),
	attributes = '\\[' + whitespace + '*(' + encoding + ')' + whitespace +
		'*(?:([*^$|!~]?=)' + whitespace + '*(?:([\'"])((?:\\\\.|[^\\\\])*?)\\3|(' + identifier + ')|)|)' + whitespace + '*\\]',
	pseudos = ':(' + encoding + ')(?:\\((((?:\\\\.|[^\\\\()[\\]]|' + attributes.replace( 3, 6 ) + ')*)|(.*))\\)|)',

	rattributeQuotes = new RegExp( '=' + whitespace + '*([^\\]\'"]*?)' + whitespace + '*\\]', 'g' ),
	rtrim = new RegExp( '^' + whitespace + '+|' + whitespace + '+$', 'g' ),
	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+|\*)|\.([\w-]+))$/,
	rwhitespace = /[\x20\t\n\r\f]+/g,
	rescape = /"|\\/g,
	rvars = /\/\*\^(.*?)\^\*\//g,

	rmatch = new RegExp( '(?:' + whitespace + '*([~+>,]|' + whitespace + ')' + whitespace + '*)?(?:([:.#]?)(' + encoding + '|\\*)|\\[' + whitespace + '*(' + encoding + ')(?:' + whitespace + '*([~^$|*!]?=)' + whitespace + '*(([\'"])((?:\\\\.|[^\\\\])*?)\\7|' + identifier + '))?' + whitespace + '*\\])', 'g' ),

	bools = 'checked|selected|async|autofocus|autoplay|controls|defer|' +
		'disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped',

	filterPriors = {
		'#': 9, '=': 9, '[': 8, 'N': 9, 'T': 8, '.': 5,
		'~=': 3, '|=': 3, '*=': 3,
	    ':not': 6, ':has': 1, ':contains': 3,
	    ':nth-child': 2, ':nth-last-child': 2,
	    ':first-child': 3, ':last-child': 3, ':only-child': 3
	},
	tuners = {id: '#', name: 'N'},
	envsCache = createCache(),
	parserCache = createCache(),
	compilerCache = {},
	xpathCache = {},
	dirruns = 0,
	docset = 1,
	uid = 'qsign_' + (new Date()).getTime(),
	isHTML = document.documentElement.nodeName === 'HTML',
	cur,
	docEnv,
	setDocument,
	parse,
	XPathParser,

	sample = [],
	push = sample.push,
	slice = sample.slice,
	push_native = sample.push;

try {
	push.apply(
		(sample = slice.call( document.childNodes )),
		document.childNodes
	);
	sample[ document.childNodes.length ].nodeType;
} catch ( e ) {
	push = {
		apply: sample.length ?
		function( dest, sender ) {
			push_native.apply( dest, slice.call(sender) );
		} :
		function( dest, sender ) {
			var k = dest.length, i = 0;
			while ( (dest[k++] = sender[i++]) ) {}
			dest.length = k - 1;
		}
	};
}

function createCache() {
	var keys = [], cache;

	return (cache = function( key, value ) {
		if ( keys.push(key) > 50 ) {
			delete cache[ keys.shift() ];
		}
		return ( cache[key] = value );
	});
}

function isNative( method ) {
	return ( method + '' ).indexOf( '[native code]' ) !== -1;
}

function exports( selector, context, seed ) {
	var i, result, nodeType, m, match, elem,
		group, newCtx, newExpr, nid, oid, arr;

	context = context || document;
	result = [];

	if ( !selector || typeof selector !== 'string' ) {
		return result;
	}

	if ( (nodeType = context.nodeType) !== 1 && nodeType !== 9 ) {
		return result;
	}

	if ( (context ? context.ownerDocument || context : document) !== cur ) {
		setDocument( context );
	}

	// Too many compatibility of native qsa, getElementXXX under XML Document in different browser, so use compiled query function
	if ( isHTML && !seed && docEnv.qsa && (!docEnv.rbuggyQSA || !docEnv.rbuggyQSA.test(selector)) ) {
		if ( (match = rquickExpr.exec( selector )) ) {
			// Speed-up: #ID
			if ( (m = match[1]) && docEnv.byId ) {
				elem = exports._byId( m, context );
				return elem ? [elem] : result;
			// Speed-up:TAG
			} else if ( match[2] ) {
				if ( selector !== '*' || !docEnv.byTagWithComment ) {
					push.apply( result, context.getElementsByTagName(selector) );
					return result;
				}
			// Speed-up: .CLASS
			} else if ( (m = match[3]) && docEnv.byClass && context.getElementsByClassName ) {
				push.apply( result, context.getElementsByClassName(m) );
				return result;
			}
		}

		nid = oid = uid;
		newCtx = context;
		newExpr = nodeType === 9 && selector;

		// qSA works strangely on Element-rooted queries
		// IE 8 doesn't work on object elements
		if ( nodeType === 1 && context.nodeName !== 'OBJECT' ) {
			group = parse( selector );
			arr = [];

			if ( (oid = context.getAttribute('id')) ) {
				nid = oid.replace( rescape, '\\$&' );
			} else {
				context.setAttribute( 'id', nid );
			}
			nid = '#' + nid;

			i = group.length;
			while ( i-- ) {
				arr[i] = nid + group[i]._text.replace( rtrim, '' );
			}
			newCtx = context.parentNode || context;
			newExpr = arr.join(',');
		}

		if ( newExpr ) {
			try {
				push.apply( result, newCtx.querySelectorAll( newExpr ) );
				return result;
			} catch (e) {} finally {
				if ( !oid ) {
					context.removeAttribute('id');
				}
			}
		}
	}

	return (isHTML || docEnv.prop) ?
		_query( selector, context, seed ) :
		_queryXML( selector, context, seed );
}

exports.error = function( message ) {
	throw new Error( 'Invalid selector: ' + message );
};

exports.match = function( elem, selector ) {
	var expr = selector.replace( rattributeQuotes, '="$1"]' ),
		result;

	if ( elem.ownerDocument !== cur ) {
		setDocument( elem );
	}

	if ( docEnv.matchesSelector &&
		( !docEnv.rbuggyMatches || !docEnv.rbuggyMatches.test( expr ) ) &&
		( !docEnv.rbuggyQSA     || !docEnv.rbuggyQSA.test( expr ) ) ) {

		try {
			result = docEnv.matchesSelector.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( result || docEnv.disconMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return result;
			}
		} catch(e) {}
	}

	return query( selector, elem.ownerDocument, [elem] ).length > 0;
};

exports.contains = function( a, b ) {
	if ( docEnv.compare || docEnv.contains ) {
		var adown = a.nodeType === 9 ? a.documentElement : a,
			bup = b && b.parentNode;
		return a === bup || !!( bup && bup.nodeType === 1 && (
			adown.contains ?
				adown.contains( bup ) :
				a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
		));
	}
	if ( b ) {
		while ( (b = b.parentNode) ) {
			if ( b === a ) { return true; }
		}
	}
	return false;
};

// Feature/bug detection & init compiler env

setDocument = function( doc ) {
	var root, matches, div, node, rbuggyQSA, rbuggyMatches;

	cur = doc = doc.ownerDocument || doc;
	root = doc.documentElement;
	isHTML = root.nodeName === 'HTML';

	if ( (div = root.getAttribute('_qset')) ) {
		return (docEnv = envsCache[div]);
	}

	//console.time('setDocument');
	docEnv = { id: ++docset };
	root.setAttribute( '_qset', docset );
	docEnv.byElem = 'nextElementSibling' in root;
	docEnv.hasAttr = isNative( root.hasAttribute );
	docEnv.qsa = isNative( doc.querySelectorAll );
	docEnv.compare = isNative( root.compareDocumentPosition );
	docEnv.contains = isNative( root.contains );
	docEnv.signal = +docEnv.byElem + '-' + (+docEnv.hasAttr);

	// Check if it's possible to set property for node, support IE < 9
	try {
		root.__qset = '';
		docEnv.prop = true;
		delete root.__qset;
	} catch (e) {} finally {
		root.removeAttribute('__qset');
	}

	// NOTE: Windows 8 Native Apps
	// The type attribute is restricted during .innerHTML assignment
	div = doc.createElement('div');
	node = doc.createElement('a');
	node.setAttribute( 'href', '#' );
	div.appendChild( node ).setAttribute( 'class', 'abc e');
	node = doc.createElement('input');
	div.appendChild( node ).setAttribute( 'class', 'abc');

	try { div.className = 'i'; } catch (e) {}
	docEnv.attributes = !div.getAttribute('className');

	// Opera can't find the second classname (in 9.6)
	// getElementsByClassName return empty
	if ( div.getElementsByClassName && div.getElementsByClassName('e').length ) {
		// Safari caches class attributes, doesn't catch changes (in 3.2)
		try { div.lastChild.className = 'e'; } catch (e) {}
		docEnv.byClass = div.getElementsByClassName('e').length === 2;
	}

	// IE will return comment node append by javascript
	div.appendChild( doc.createComment('') );
	docEnv.byTagWithComment = div.getElementsByTagName('*').length > 2;

	// Check if getElementById returns elements by name. IE < 10
	root.appendChild( div ).setAttribute( 'id', uid );
	docEnv.byId = !doc.getElementsByName || !doc.getElementsByName( uid ).length;
	root.removeChild( div );

	// IE < 9, getAttribute bool attr works unexpectedlly
	docEnv.boolAttrFix = !(div.getAttribute('disabled') == null);

	rbuggyQSA = [];
	rbuggyMatches = [];

	// QSA buggy detection
	if ( docEnv.qsa ) {
		div = doc.createElement('div');
		div.appendChild( doc.createElement('select') );
		(node = doc.createElement('option')).setAttribute('selected', '');
		div.firstChild.appendChild( node );

		// IE8 - Some boolean attributes are not treated correctly
		if ( !div.querySelectorAll('[selected]').length ) {
			rbuggyQSA.push( '\\[' + whitespace + '*(?:value|' + bools + ')' );
		}

		// :checked should return selected option elements
		// IE8 throws exceptions for some dynamic pseudos
		try {
			if ( !div.querySelectorAll(':checked').length ) {
				rbuggyQSA.push( ':checked' );
			}
		} catch (e) {}

		// Support: Opera 10-12/IE8
		// ^= $= *= and empty values
		// Should not select anything
		node = doc.createElement( 'input' );
		node.setAttribute( 'type', 'hidden' );
		div.appendChild( node ).setAttribute( 'i', '' );
		try {
			if ( div.querySelectorAll('[i^=""]').length ) {
				rbuggyQSA.push( '[*^$]=' + whitespace + '*(?:\'\'|"")' );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements are enabled
			// IE8 throws error here and will not see later tests
			if ( !div.querySelectorAll(':enabled').length ) {
				rbuggyQSA.push( ':enabled', ':disabled' );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			div.querySelectorAll( '*,:x' );
			rbuggyQSA.push( ',.*:' );
		} catch (e) {}

		docEnv.rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join('|') );
	}

	if ( isNative( (matches = root.webkitMatchesSelector ||
		root.mozMatchesSelector ||
		root.oMatchesSelector ||
		root.msMatchesSelector) ) ) {

		docEnv.matchesSelector = matches;
		// Check to see if it's possible to do matchesSelector
		// on a disconnected node (IE 9)
		docEnv.disconMatch = matches.call( div, 'div' );

		// This should fail with an exception
		// Gecko does not error, returns false instead
		try {
			matches.call( div, '[s!=""]:x' );
			rbuggyMatches.push( '!=', pseudos );
		} catch (e) {}

		docEnv.rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join('|') );
	}

	div = node = null;

	// Priority of seed selector
	docEnv.seedPriors = {
		'#': docEnv.byId ? 9 : 0,
		'N': docEnv.byName ? 7 : 0, 
		'.': docEnv.byClass ? 6 : 0,
		':root': 9, ':active': 9, 'T': 5
	};

	//console.timeEnd('setDocument')
	return envsCache( docset, docEnv );
};

// Core: Parser and Compiler

function make( type, array ) {
	return (array._type = type, array);
}

function substitute( str, prop ) {
	return str.replace(/\$\{([^}]+)\}/g, function ( m, p ) {
		return typeof prop[p] !== strundef ? prop[p] + '' : m;
	});
}

function filterSort( a, b ) {
	return a._fp - b._fp;
}

parse = function() {
	var text, index, last;

	function match( regex ) {
		var matched = (regex.lastIndex = index, regex.exec(text));
		return matched && matched.index === index ?
			(index = regex.lastIndex, matched) : null;
	}
	function error() {
		throw [ 'ParseError', text, index ];
	}
    function parse() {
        var queue = [],
        	chain = [ queue ],
        	group = [ chain ],
        	unit, matched, pos;

		while ( (matched = match( rmatch )) ) {
			// Comma/Combinators
			if ( matched[1] ) {
				if ( matched[1] === ',' ) {
					chain._text = text.substr( last, (last = matched.index + 1) );
					group.push( chain = [] );
				}
				if ( queue.length ) {
					chain.push( queue = [] );
				}
				if ( matched[1] !== ',' ) {
					queue._union = matched[1];
				}
			}

			unit = [ (matched[4] || matched[3]).replace(rescape, '\\$&') ];
			if ( matched[6] ) {
				pos = matched[6].charAt(0);
				pos = (pos === '\'' || pos === '"') ? matched[6].slice( 1, -1 ) : matched[6];
				unit.push( pos.replace(/"|\\/g, '\\$&') );
			}
			unit._type = matched[5] || (matched[4] ? '[' : matched[2] || 'T');
			if ( unit[0] === '*' && unit._type !== 'T' ) {
				error();
			}
			if ( (matched[2] == ':') ) {
				unit._type = ':' + matched[3];
				if ( text.charAt(index) === '(' ) {
					index++;
					if ( matched[3] === 'not' || matched[3] === 'has' ) {
						pos = index;
						// Recursively
						unit[0] = parse();
						unit[1] = text.slice( pos, index );
						// Found a closing parentheses
						if ( text.charAt(index) === ')' ) {
							index++;
						} else {
							error();
						}
					} else {
						pos = text.indexOf( ')', index );
						if ( pos !== -1 ) {
							unit[0] = text.slice( index, pos ).replace( rtrim, '' );
							index = pos + 1;
						} else {
							error();
						}

						if ( matched[3].indexOf('nth') === 0 ) {
							pos = unit[0];
							pos = (pos === 'even' ? '2n' : pos === 'odd' ? '2n+1' : (pos.indexOf('n') === -1 ? '0n': '') + pos.replace(/\s*/g, '')).split('n');
							unit[0] = !pos[0] ? 1 : +(pos[0]) | 0;
							unit[1] = +(pos[1]) | 0;
						}
					}
				}
			}
			queue.push( unit );
		}
		chain._text = text.substr( last );
		return group;
	}

	return function( selector ) {
		text = selector.replace( rtrim, '' );
		index = last = 0;
		selector = parse();
		match( /\s*/g );
		last = 0;
		return index < text.length ? error() : selector;
	};
}();

function process( queue ) {
	var seedPriors = docEnv.seedPriors,
		i = queue.length,
		unit, seed;

	while ( i-- ) {
		unit = queue[i];
		if ( unit._type == '=' ) {
			if ( tuners[unit[0]] ) {
				unit = make( tuners[unit[0]], [unit[1]] );
			}
		} else if ( unit._type === '~=' && unit[0] === 'class' ) {
			unit = make( '.', [unit[1]] );
		}

		if ( unit._type == 'T' ) {
			if ( unit[0] == '*' ) {
				unit._type = '*';
			} else {
				queue._tag = unit;
			}
		} else if ( unit._type == '.' ) {
			if ( !queue._class ) {
				queue._class = unit;
			} else {
				queue._class.push( unit[0] );
				unit._type = '*';
			}
		}

		unit._sp = seedPriors[unit._type] | 0;
		unit._fp = filterPriors[unit._type] | 0;
		if ( unit._sp && (!seed || unit._sp > seed._sp) ) {
			seed = unit;
		}
		queue[i] = unit;
	}

	queue.sort( filterSort );
	queue.$ = seed;
	return queue;
}

function compose( chain ) {
	var part = [],
		parts = [part],
		i = chain.length,
		queue, next;

	while ( i-- ) {
		queue = chain[i];
		queue = process( queue );
		queue.N = 'n' + i;
		if ( queue.$ && (!part._sp || queue.$._sp > part._sp ||
			(queue.$._sp === part._sp && parts.length === 1)) ) {
			part._sp = queue.$._sp;
			part._index = part.length;
		}
		part.push( queue );
		if ( queue._union === ' ' && i && typeof part._index !== strundef ) {
			parts.push( part = [] );
			part._sp = 0;
		}
		if ( i === chain.length - 1 && queue._tag ) {
			chain._tag = queue._tag;
		}
	}

	for ( i = 0; i < parts.length; i++ ) {
		part = parts[i];
		if ( (next = parts[i + 1]) ) {
			if ( part._sp > next._sp || (part._sp === next._sp && next._index !== 0) ) {
				parts.splice( i + 1, 1 );
				part.push.apply( part, next );
				i--;
			} else {
				part.R = next[0].N;
			}
		} else {
			part.R = 'root';
		}
	}

	if ( typeof parts[0]._index === strundef ) {
		parts[0]._index = 0;
		parts[0][0].$ = make( '*', ['*'] );
	}

	return parts;
}

var attrsFix = {
	'for': '${N}.htmlFor',
	'class': '${N}.className',
	// IE < 9, read its property not attribute
	'value': '${N}.defaultValue',
	'type': '${N}.getAttribute("type",1)',
	'href': '${N}.getAttribute("href",2)',
	'height': '${N}.getAttribute("height",2)',
	'width': '${N}.getAttribute("width",2)'
};
var boolAttrs = (function() {
	var hash = {},
		arr = bools.split('|'),
		item;
	while ( (item = arr.shift()) ) {
		hash[item] = 1;
	}
	return hash;
})();

function $_attr( name ) {
	if ( !isHTML ) {
		return '${N}.getAttribute("' + name + '")';
	}

	name = name.toLowerCase();
	return attrsFix[name] ?
		name === 'class' ? attrsFix[name] : '(' + attrsFix[name] + '||"")' :
		boolAttrs[name] && docEnv.boolAttrFix ?
			'(${N}.getAttribute("' + name + '")?"' + name + '":"")' :
			'${N}.getAttribute("' + name + '")';
}

function $_match( unit ) {
	var type = unit._type, t;

	if ( type.indexOf('=') !== -1 ) {
		unit.A = substitute( $_attr(unit[0]), unit );
	}

	if ( unit._seed ) {
		delete unit._seed;
		return '';
	}

	switch ( type ) {
		case '.':
			var i = unit.length, arr = [];
			while ( i-- ) {
				arr.push( '/*^var r' + (++dirruns) + '=new RegExp("(^|' + whitespace + ')${' + i + '}(' + whitespace + '|$)");^*/r' + dirruns + '.test(t)' );
			}
			return substitute( '(t=${N}.getAttribute("class"))&&' + arr.join(' && '), unit );
		case '^=':
		case '$=':
		case '*=':
			if ( (unit.L = unit[1].length) === 0 ) {
				return 'false';
			}
			break;
		case '~=':
			unit.D = dirruns++;
			unit.S = '(^|' + whitespace + ')' + unit[1] + '(' + whitespace + '|$)';
			break;
		case ':nth-child':
		case ':nth-last-child':
		case ':nth-of-type':
		case ':nth-last-of-type':
			if ( unit[0] === 1 && unit[1] === 0 ) {
				return '';
			}
			break;
		case ':not':
			if ( unit[0].length === 1 && unit[0][0].length === 1 ) {
				t = $_filter( unit[0][0][0] );
				return t ? '!(' + substitute(t, unit) + ')' : 'false';
			}
			unit.D = dirruns++;
			break;
		case ':has':
			unit.D = dirruns++;
			break;
		case '*':
			return '';
	}

	t = T_FILTER[type];
	return t ? substitute( t.indexOf ? t : t(), unit ) : 'false';
}

function $_filter( queue ) {
	var c = [],
		i = queue.length,
		code, unit;

	while ( i-- ) {
		unit = queue[i];
		unit.N = queue.N;
		if ( (code = $_match(unit)) ) {
			c.push( code );
		}
	}

	return c.join( ' && ' );
}

function $_condition( queue, then ) {
	var code = $_filter( queue );
	return code ? 'if(' + code + '){' + then + '}' : then;
}

function $_find( queue, R, union, then ) {
	var code, seed, t;

	union = union || queue._union;
	if ( union === ' ' ) {
		if ( (seed = queue.$) ) {
			t = T_SEED[seed._type];
			code = t.indexOf ? t : t();
			seed._seed = true;
		} else {
			code = T_SEED['*']();
		}
	} else if ( docEnv.byChildrenTag && union === '>' && queue._tag ) {
		code = T_SEED['>T'];
		seed = queue._tag;
		seed._seed = true;
	} else {
		t = T_SEED[union];
		code = t.indexOf ? t : t();
	}

	return substitute(code, {
		P: seed && (seed._type === '.' ? seed.join(' ') : seed[0]),
		N: queue.N,
		R: R,
		X: $_condition( queue, then )
	});
}

function $_right( part, isLast, then ) {
	var code = then,
		k = part._index,
		i, excess;

	if ( isLast ) {
		code = substitute( code, {N: part[0].N} );
	} else {
		if ( (i = part[0].$._type) && (i !== 'S' && i !== '#') ) {
			excess = docEnv.compare ?
				'(${0}.compareDocumentPosition(${1})&16)' :
				docEnv.contains ? '${0}.contains(${1})' : 's.contains(${0},${1})';
			excess = '/*^var ${N}v;^*/if(!${N}v||!' + substitute(excess, ['${N}v', '${N}']) + '){${X}${N}v=${N};}';
			code = substitute( excess, {N: part[0].N, X: code} );
		}
	}

	i = -1;
	while ( ++i < k ) {
		code = $_find( part[i], part[i + 1].N, false, code );
	}

	return code;
}

function $_left( part, then, isFirst ) {
	var R = part.R,
		s = part._index,
		i = part.length - 1,
		code = 'break P_' + R + ';',
		queue, last, t;

	if ( isFirst && part[i]._union ) {
		t = T_CONTEXT[ part[i]._union ];
		code = substitute(t.indexOf ? t : t(), {
			C: part[i].N,
			N: 'nc',
			R: R,
			X: code
		});
	}

	while ( i > s ) {
		queue = part[i];
		last = part[i - 1];
		t = T_LPROC[last._union];
		i--;

		code = substitute(t.indexOf ? t : t(), {
			N: queue.N,
			C: last.N,
			X: $_condition( queue, code ),
			R: R
		});
	}

	return substitute(T_LEFT, {
		R: R,
		X: code,
		Y: then
	});
}

function $_build( chain ) {
	var parts = compose( chain ),
		code = T_PUSH,
		c = parts.length - 1,
		i = -1,
		part, s;

	dirruns = 0;
	while ( (part = parts[++i]) ) {
		code = $_right( part, i === 0, code );
		if ( (s = part._index) < part.length - 1 ) {
			code = $_left( part, code, i === c );
		}
		code = $_find( part[s], part.R, ' ', code );
	}

	return code;
}

function compile( selector ) {
	var group = parse( selector ),
		i = group.length,
		func = [],
		code, hash, vars;

	while ( i-- ) {
		code = $_build( group[i] );
		hash = {};
		vars = [];
		code = code.replace(rvars, function ( m, p ) {
			return (hash[p] || (hash[p] = vars.push(p)), '');
		});
		code = vars.join('') + 'var k=q._qset,v=q._qnum;' + code;
		code = 'return (' + T_MAIN.replace( '${X}', code ) + ');';
		func[i] = new Function( 'q', code )( exports );
	}

	if ( func.length === 1 ) {
		return func[0];
	}

	return function( root ) {
		var i = func.length,
			result = [],
			push = result.push;
		while ( i-- ) {
			push.apply( result, func[i](root) );
		}
		return result;
	};
}

var T_DOC = '/*^var doc=root.ownerDocument||root;^*/';
var T_ROOT = T_DOC + '/*^var docElem=doc.documentElement;^*/';
var T_HTML = T_ROOT + '/*^var isHTML=docElem.nodeName==="HTML";^*/'
var T_PUSH = 'r[l++]=${N};';
var T_SIGN = '${N}._qset||(${N}._qset=++k)';
var T_LOOP = 'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++)';
var T_MAIN = 'function(root){var r=[],l=0,t;BQ:{${X}}q._qset=k;return r;}';
var T_SEED = {
	'#': 'var ${N}=q._byId("${P}",${R});if(${N}){${X}}',
	'N': function() {
		var excess = docEnv.compare ?
			'(${0}.compareDocumentPosition(${1})&16)' :
			docEnv.contains ? '${0}.contains(${1})' : 's.contains(${0},${1})';
		return T_DOC + 'var ${N}a=doc.getElementsByName("${P}");' + T_LOOP + '{if(${R}===doc||' + substitute(excess, ['${R}','${N}']) +'){${X}}}';
	},
	'T': 'var ${N}a=${R}.getElementsByTagName("${P}");' + T_LOOP + '{${X}}',
	'.': 'var ${N}a=${R}.getElementsByClassName("${P}");' + T_LOOP + '{${X}}',
	'*': function() {
		var t = docEnv.byTagWithComment ? 'if(${N}.nodeType===1){${X}}' : '${X}';
		return 'var ${N}a=${R}.getElementsByTagName("*");' + T_LOOP + '{' + t + '}';
	},
	'+': function() {
		return docEnv.byElem ?
			'/*^var ${N};^*/if(${N}=${R}.nextElementSibling){${X}}' :
			'var ${N}=${R};while((${N}=${N}.nextSibling)){if(${N}.nodeType===1){${X}break;}}';
	},
	'~': function() {
		return docEnv.byElem ?
			'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextElementSibling){if(${N}h[' + T_SIGN + '])break;${N}h[' + T_SIGN + ']=1;${X}}' :
			'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextSibling){if(${N}.nodeType==1){if(${N}h[' + T_SIGN + '])break;${N}h[' + T_SIGN + ']=1;${X}}}';
	},
	'>': 'var ${N}a=${R}.children||${R}.childNodes;' + T_LOOP + '{if(${N}.nodeType==1){${X}}}',
	'>T': 'var ${N}a=${R}.children.tags("${P}");' + T_LOOP + '{${X}}'
};
var T_LEFT = 'var ${R}V={_:false};NP_${R}:{P_${R}:{${X}break NP_${R};}${R}V._=true;${Y}}';
var T_LBODY = 'if(t=${N}h[' + T_SIGN + ']){if(t._){break P_${R};}else{break NP_${R};}}${N}h[' + T_SIGN + ']=${R}V;${X}';
var T_LBACK = T_LBODY.replace( '${X}', 'if(${N}!==${R}){${X}}' );
var T_LPROC = {
	'>': '/*^var ${N}h={};^*/var ${N}=${C}.parentNode;' + T_LBACK,
	' ': '/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.parentNode){' + T_LBACK + '}',
	'+': function() {
		return docEnv.byElem ?
			'var ${N};if(${N}=${C}.previousElementSibling){${X}}' :
			'var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){${X}break;}}';
	},
	'~': function() {
		return docEnv.byElem ?
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousElementSibling){' + T_LBODY + '}' :
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling){' + T_LBODY + '}';
	}
};
var T_CONTEXT = {
	'>': 'if(${C}.parentNode===root){${X}}',
	'+': function() {
		return docEnv.byElem ?
			'if(root===${C}.previousElementSibling){${X}}' :
			'var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){if(${N}===root){${X}}break;}}';
	},
	'~': function() {
		var t = T_LBODY.replace('${X}', 'if(${N}===root){${X}}');
		return docEnv.byElem ?
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousElementSibling){' + t + '}' :
			'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){' + t + '}}';
	}
};
var T_FILTER = {
	'T': T_HTML + '/*^var ${N}t=isHTML?"${0}".toUpperCase():"${0}";^*/${N}.nodeName===${N}t',
	'#': '${N}.id==="${0}"',
	'N': '${N}.name==="${0}"',

	'[': function() {
		return docEnv.hasAttr ?
			'${N}.hasAttribute("${0}")' :
			'(t=${N}.getAttributeNode("${0}"))&&(t.specified)';
	},
	'=': '${A}==="${1}"',
	'!=': '${A}!=="${1}"',
	'^=': '(t=${A})&&t.indexOf("${1}")===0',
	'$=': '(t=${A})&&t.substr(-${L})==="${1}"',
	'*=': '(t=${A})&&t.indexOf("${1}")!==-1',
	'|=': '(t=${A})&&(t+"-").indexOf("${1}-")===0',
	'~=': '/*^var r${D}=new RegExp("${S}");^*/(t=${A})&&r${D}.test(t)',

	':root': T_ROOT + '${N}===docElem',
	':empty': 'q._isEmpty(${N})',
	':lang': '${N}.getAttribute("lang")==="${0}"',
	':link': '(t=${N}.nodeName)&&(t==="A"||t==="AREA")&&!${N}.visited',
	':visited': '(t=${N}.nodeName)&&(t==="A"||t==="AREA")&&${N}.visited',
	':hover': T_DOC + '${N}===doc.hoverElement',
	':active': T_DOC + '${N}===doc.activeElement',
	':focus': T_DOC + '${N}===doc.activeElement&&(!doc.hasFocus||doc.hasFocus())&&!!(${N}._type||${N}.href||~${N}.tabIndex)',
	':target': '/*^var target=window.loaction&&window.loaction.hash.substr(1);^*/target&&target===${N}.id',
	':enabled': '${N}.disabled===false',
	':disabled': '${N}.disabled===true',
	':checked': '(t=${N}.nodeName)&&(t==="INPUT"&&!!${N}.checked)||(t==="OPTION"&&!!${N}.selected)',
	':contains': '(${N}.textContent||${N}.innerText).indexOf("${0}")!==-1',

	':nth-child': 'q._isNthChild(${N},${0},${1},v)',
	':nth-last-child': 'q._isNthChild(${N},${0},${1},v,true)',
	':nth-of-type': 'q._isNthType(${N},${0},${1},v)',
	':nth-last-of-type': 'q._isNthType(${N},${0},${1},v,true)',

	':first-child': function() {
		return docEnv.byElem ?
			T_ROOT + '${N}!==docElem&&!${N}.previousElementSibling' :
			T_ROOT + '${N}!==docElem&&q._isChild(${N},true)';
	},
	':last-child': function() {
		return docEnv.byElem ?
			T_ROOT + '${N}!==docElem&&!${N}.nextElementSibling' :
			T_ROOT + '${N}!==docElem&&q._isChild(${N})';
	},
	':only-child': function() {
		return docEnv.byElem ?
			T_ROOT + '${N}!==docElem&&!${N}.previousElementSibling&&!${N}.nextElementSibling' :
			T_ROOT + '${N}!==docElem&&q._isChild(${N})&&q._isChild(${N},true)';
	},
	':first-of-type': function() {
		return T_ROOT + '${N}!==h&&q._isType(${N},true)';
	},
	':last-of-type': function() {
		return T_ROOT + '${N}!==h&&q._isType(${N})';
	},
	':only-of-type': function() {
		return T_ROOT + '${N}!==h&&q._isType(${N})&&q._isType(${N},true)';
	},

	':not': T_DOC + '/*^var c${D}=q._hash(q("${1}",doc,doc));^*/!c${D}[' + T_SIGN + ']',
	':has': T_DOC + '(q._qset=k,t=q("${1}",${N},doc),k=q._qset,t.length>0)'
};

function _query( selector, context, seed ) {
	var signal = docEnv.signal,
		cache, select, result;

	if ( !(cache = compilerCache[signal]) ) {
		cache = compilerCache[signal] = {};
	}

	exports._qnum += 1;
	select = cache.hasOwnProperty(selector) ?
		cache[ selector ] : (cache[selector] = compile(selector));
	result = select( context );

	return seed ? exports._in(seed, result) : result;
}

XPathParser = {
	AXES: {
		' ': 'descendant::*',
		'>': 'child::*',
		'~': 'following-sibling::*',
		'+': 'following-sibling::*[1]'
	},
	RAXES: {
		' ': 'ancestor::*',
		'>': 'parent::*',
		'~': 'preceding-sibling::*',
		'+': 'preceding-sibling::*[1]'
	},
	ATTRS: {
		'*': '',
		'T': 'local-name()="${0}"',
		'#': '@id and @id="${0}"',
		'N': '@name and @name="${0}"',
		'.': '@class and contains(concat(" ", @class, " "), concat(" ","${0}"," "))',

		'[': '@${0}',
		'=': '@${0}="${1}"',
		'!=': '@${0}!="${1}"',
		'^=': '(@${0} and starts-with(@${0},"${1}")',
		// TODO
		'$=': function( name, val ) {
			return substitute('(@${0} and substring(@${0},string-length(@${0})-${P})="${1}"', {'0': name, '1': val, P: val.length - 1});
		},
		'*=': '(@${0} and contains(@${0},"${1}")',
		'|=': 'starts-with(concat(@${0},"-"),"${1}-")',
		'~=': '(@${0} and contains(concat(" ",@${0}," ")," ${1} "))',

		'contains': 'count(descendant-or-self::node()[contains(text(),"${0}")])>0',
		':root': 'not(parent::*)',
		':empty': '(not(*) and not(string-length()))',
		':lang': '@lang="${0}"',
		':link': '0',
		':visited': '0',
		':hover': '0',
		':active': '0',
		':focus': '0',
		':target': '0',
		':enabled': '0',
		':disabled': '0',
		':checked': '0',
		':contains': '0',

		':nth-child': function( a, b ) {
			if ( a === 0 ) {
				return 'position()=' + b;
			} else if ( a === 1 ) {
				return b === 0 ? '' : 'position()>=' + b;
			}
			return '(position()>=' + b + ' and (position()-' + b +
				') mod ' + a + '=0)';
		},
		':nth-last-child': function( a, b ) {
			if ( a === 0 ) {
				return '(last()-position()+1)=' + b;
			} else if ( a === 1 ) {
				return b === 0 ? '' : '(last()-position()+1)>=' + b;
			}
			return '((position()+' + (b - 1) + ')<=last() and ' +
					'(last()-position()-' + (b - 1) + ') mod ' + a + '=0)';
		},
		':nth-of-type': function( a, b ) {
			return XPathParser.ATTRS[':nth-child'](a, b);
		},
		':nth-last-of-type': function( a, b ) {
			return XPathParser.ATTRS[':nth-last-child'](a, b);
		},
		':first-child': 'position()=1',
		':last-child': 'position()=last()',
		':only-child': 'last()=1',
		':first-of-type': 'position()=1',
		':last-of-type': 'position()=last()',
		':only-of-type': 'last()=1',

		':has': function( text ) {
			return 'count(' + XPathParser.parse( text, 'self::*/' ) + ')>0';
		},
		':not': function( group ) {
			var paths = [], i = -1, token;

			while ( (token = group[++i]) ) {
				paths.push( XPathParser._raxes(token) );
			}

			return paths.join( ' and ' );
		}
	},
	_match: function( queue ) {
		var i = -1,
			arr = [],
			unit, t, type;

		while ( (unit = queue[++i]) ) {
			if ( !unit._skip) {
				type = unit._type;
				if ( (t = this.ATTRS[type]) ) {
					if ( type !== 'T' || unit[0] !== '*' ) {
						t = t.indexOf ? substitute(t, unit) : t(unit[0], unit[1]);
						arr.push( t );
					}
				} else {
					arr.push( '0' );
				}
			} else {
				delete unit._skip;
			}
		}

		return arr.length ? arr.join(' and ') : '';
	},
	_axis: function( queue, prefix, rev ) {
		var union = queue._union || ' ',
			i = -1,
			axis = '',
			token, tag, type, nthType;

		if ( union ) {
			axis =  (rev ? this.RAXES : this.AXES)[union];
		}

		while ( (token = queue[++i]) ) {
			type = token._type;
			if ( type === 'T' ) {
				if ( token[0] !== '*' ) {
					tag = token;
				}
			} else if ( /^(nth|nth-last)-of-type$/.test(type) ) {
				nthType = true;
			}
		}

		if ( tag ) {
			if ( nthType ) {
				tag._skip = true;
				axis = axis.replace( '*', tag[0] );
			}
		}

		return prefix ? prefix + axis : axis;
	},
	_axes: function( token, prefix ) {
		var path = '',
			i = -1,
			j = token.length - 1,
			path = '',
			queue, attr;

		while ( (queue = token[++i]) ) {
			path += this._axis( queue, i === 0 && prefix );
			attr = this._match( queue );
			path += attr ? '[' + attr + ']' : '';
			if ( i < j ) {
				path += '/';
			}
		}

		return path;
	},
	_raxes: function( token ) {
		var prefix = '',
			suffix = '',
			i = token.length,
			skip = false,
			queue, axis, attr;

		if ( i === 0 ) {
			return 'not(' + this._match(token[0]) + ')';
		}

		while ( i-- ) {
			queue = token[i];
			axis = this._axis( queue, false, true );
			attr = this._match( queue );

			if ( !skip ) {
				prefix = attr ? attr + ' and ' : '';
				skip = true;
			} else {
				suffix += axis + (attr ? '[' + attr + ']' : '');
				if ( i > 0 ) {
					suffix += '/';
				}
			}
		}

		return 'not(' + prefix + suffix + ')';
	},
	parse: function( selector, prefix ) {
		var group = parse( selector ),
			paths = [], i = -1, token;

		while ( (token = group[++i]) ) {
			paths.push( this._axes(token, prefix) );
		}

		return paths.join('|');
	}
};

function _queryXML( selector, context, seed ) {
	var path = xpathCache.hasOwnProperty(selector) ?
			xpathCache[selector] :
			(xpathCache[selector] = XPathParser.parse(selector)),
		result = [], ret, elem, i;

	if ( typeof context.selectNodes !== strundef ) {
		i = 0;
		ret = context.selectNodes( path );
		while ( (elem = ret.item(i++)) ) {
			result.push( elem );
		}
	} else {
		ret = (context.ownerDocument || context).evaluate(path, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		while ( (elem = ret.iterateNext()) ) {
			result.push( elem );
		}
	}

	return seed ? exports._in(seed, result) : result;
}

// Internal utils

exports._qset = exports._qnum = 1;

exports._hash = function( elems ) {
	var cache = elems._qset,
		i, qset, elem;

	if ( !cache ) {
		i = elems.length;
		qset = exports._qset;

		cache = elems._qset = {};
		while ( i-- ) {
			elem = elems[i];
			cache[elem._qset || (elem._qset = ++qset)] = true;
		}
		exports._qset = qset;
	}

	return cache;
};

exports._in = function( elems, seed ) {
	var hash = exports._hash( seed ),
		qset = exports._qset,
		len = elems.length,
		result = [],
		elem, i;

	for ( i = 0; i < len; i++ ) {
		elem = elems[i];
		if ( hash[elem._qset||(elem._qset = ++qset)] ) {
			result.push( elem );
		}
	}
	exports._qset = qset;
	return result;
};

exports._compile = function( selector, context ) {
	if ( (context ? context.ownerDocument || context : document) !== cur ) {
		setDocument( context );
	}
	return compile( selector );
};

exports._byId = function( id, context ) {
	var elem, doc;

	if ( context.nodeType === 9 ) {
		elem = context.getElementById( id );
		return elem && elem.parentNode ? elem : null;
	} else {
		doc = context.ownerDocument || context;
		elem = doc.getElementById( id );
		return elem && exports.contains(context, elem) ? elem : null;
	}

	return null;
};

exports._isEmpty = function( elem ) {
	for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
		if (  elem.nodeType < 6 ) {
			return false;
		}
	}
	return true;
};

exports._isNthChild = function ( elem, a, b, rev, backward ) {
	var p = elem.parentNode,
		num, nodes, t, i;

	if ( p && (p._qnum !== rev || !elem._qsign) ) {
		num = 0;
		if ( docEnv.byElem ) {
			t = p.firstElementChild;
			while (t) {
				t._qsign = ++num;
				t = t.nextElementSibling;
			}
		} else {
			nodes = p.children || p.childNodes;
			for ( i = 0; t = nodes[i]; i++ ) {
				if ( t.nodeType === 1 ) {
					t._qsign = ++num;
				}
				t = t.nextSibling;
			}
		}
		p._qnum = rev;
		p._qchi = num;
	}

	t = backward ? p._qchi - elem._qsign + 1 : elem._qsign;
	return a ? ( t - b ) % a === 0 : t === b;
};

exports._isNthType = function ( elem, a, b, rev, backward ) {
	var p = elem.parentNode,
		num, nodes, name, t;

	if ( p && (p._qnum !== rev || !elem._qsign) ) {
		num = 0;
		name = elem.nodeName;
		if ( docEnv.byElem ) {
			t = p.firstElementChild;
			while (t) {
				if ( t.nodeName === name ) {
					t._qsign = ++num;
				}
				t = t.nextElementSibling;
			}
		} else {
			nodes = p.children || p.childNodes;
			for ( i = 0; t = nodes[i]; i++ ) {
				if ( t.nodeName === name ) {
					t._qsign = ++num;
				}
				t = t.nextSibling;
			}
		}
		p._qnum = rev;
		p._qchi = num;
	}

	t = backward ? p._qchi - elem._qsign + 1 : elem._qsign;
	return a ? ( t - b ) % a === 0 : t === b;
};

exports._isChild = function( elem, backward ) {
	var dir = backward ? 'previousSibling' : 'nextSibling';
	while ( (elem = elem[dir]) ) {
		if ( elem.nodeType === 1) { return false; }
	}
	return true;
};

exports._isType = function( elem, backward ) {
	var name = elem.nodeName,
		dir = backward ? 'previousSibling' : 'nextSibling';
	while ( (elem = elem[dir]) ) {
		if ( elem.nodeName === name) { return false; }
	}
	return true;
};

parse('div.a p a');
setDocument( document );

// EXPOSE API

if ( typeof define === 'function' && (define.amd || define.cmd) ) {
	define(function() { return exports; });
} else {
	window.query = exports;
}

})( window );