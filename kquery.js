/*
 * KQuery - Super Fast and Compatible CSS Selector Engine
 * Copyright (C) 2011 - 2013 aaron.xiao
 * Author: aaron.xiao <admin@veryos.com>
 * Version: 2.0b
 * Release: 2013/08/17
 * License: http://kquery.veryos.com/MIT-LICENSE
 * Credits: 
 * Sizzle.js - http://sizzlejs.org
 *   - buggy detection
 */


(function( window ) {

var version = '2.0.build',
	document = window.document,
	// Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = '[\\x20\\t\\r\\n\\f]',
	// http://www.w3.org/TR/css3-syntax/#characters
	encoding = '(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+',
	// CSS identifier characters
	identifier = encoding.replace( 'w', 'w#' ),
	// Acceptable operators http://www.w3.org/TR/selectors/#attribute-selectors
	operators = '([*^$|!~]?=)',
	attributes = '\\[' + whitespace + '*(' + encoding + ')' + whitespace +
		'*(?:' + operators + whitespace + '*(?:([\'"])((?:\\\\.|[^\\\\])*?)\\3|(' +
		identifier + ')|)|)' + whitespace + '*\\]',
	pseudos = ':(' + encoding + ')(?:\\((((?:\\\\.|[^\\\\])*?)|((?:\\\\.|[^\\\\()[\\]]|' +
		attributes.replace( 3, 7 ) + ')*)|.*)\\)|)',

	rtrim = new RegExp( '^' + whitespace + '+|((?:^|[^\\\\])(?:\\\\.)*)' +
		whitespace + '+$', 'g' ),
	rcomma = new RegExp( '^' + whitespace + '*,' + whitespace + '*' ),
	rcombinators = new RegExp( '^' + whitespace + '*([\\x20\\t\\r\\n\\f>+~])' +
		whitespace + '*' ),
	// CSS escapes http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( '\\\\([\\da-f]{1,6}' + whitespace + '?|(' + whitespace +
		')|.)', 'ig' ),
	rattributeQuotes = new RegExp( '=' + whitespace + '*([^\\]"\']*)' + whitespace +
		'*\\]', 'g' ),
	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
	rwhitespace = /[\x20\t\n\r\f]+/g,
	rescape = /'|\\/g,

	regexps = {
		'*': /^(\*)/,
		'TAG': new RegExp( '^(' + encoding.replace( 'w', 'w*' ) + ')' ),
		'ID': new RegExp( '^#(' + encoding + ')' ),
		'CLASS': new RegExp( '^\\.(' + encoding + ')' ),
		'ATTR': new RegExp( '^' + attributes ),
		'CHILD': new RegExp( '^:(nth|nth-last)-(child|of-type)(?:\\(' +
			whitespace + '*(even|odd|(([+-]|)(\\d*)n|)' + whitespace + '*(?:([+-]|)' +
			whitespace + '*(\\d+)|))' + whitespace + '*\\)|)', 'i' ),
		'PSEUDO': new RegExp( '^' + pseudos )
	},

	hasOwn = {}.hasOwnProperty,
	strundef = typeof undefined,

	tarray = [],
	push = tarray.push,
	slice = tarray.slice,
	push_native = tarray.push;

/*
 * Helper functions
 */

try {
	push.apply(
		(tarray = slice.call( document.childNodes )),
		document.childNodes
	);
	tarray[ document.childNodes.length ].nodeType;
} catch ( e ) {
	push = {apply: tarray.length ?
		function( target, sender ) {
			push_native.apply( target, slice.call(sender) );
		} :
		function( accepter, sender ) {
			var k = accepter.length, i = 0;
			while ( (accepter[k++] = sender[i++]) ) {}
			accepter.length = k - 1;
		}
	};
}

function createCache() {
	var keys = [], cache;

	return (cache = function( key, value ) {
		if ( keys.push( key += ' ' ) > 50 ) {
			delete cache[ keys.shift() ];
		}
		return ( cache[ key ] = value );
	});
}

function isNative( method ) {
	return ( method + '' ).indexOf( '[native code]' ) > -1;
}

function isXML( elem ) {
	var r = elem && (elem.ownerDocument || elem).documentElement;
	return r ? r.nodeName !== 'HTML' : false;
}

function funescape( _, escaped, escapedWhitespace ) {
	var high = "0x" + escaped - 0x10000;
	// NaN means non-codepoint
	// Support: Firefox
	// Workaround erroneous numeric interpretation of +"0x"
	return high !== high || escapedWhitespace ?
		escaped :
		// BMP codepoint
		high < 0 ?
			String.fromCharCode( high + 0x10000 ) :
			// Supplemental Plane codepoint (surrogate pair)
			String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
}

function tags( names, context ) {
	var i = -1, result = [], name;

	names = names.split(',');
	while ( (name = names[++i]) ) {
		push.apply( result, context.getElementsByTagName(name) );
	}

	return result;
}

function byIdRaw( id, context ) {
	var elems = context.getElementsByTagName('*'),
		i = -1, elem = null;

	while ( (elem = elems[++i]) ) {
		if ( elem.nodeType === 1 && elem.getAttribute('id') === id ) {
			return elem;
		}
	}

	return elem;
}

function byTagRaw( context ) {
	var elems = context.getElementsByTagName('*'),
			i = -1, result = [], elem;

	while ( (elem = elems[++i]) ) {
		if ( elem.nodeType === 1 ) {
			result.push( elem );
		}
	}
	return result;
}

function byClassRaw( name, context ) {
	var elems = context.getElementsByTagName('*'),
		i = -1, result = [], elem;

	while ( (elem = elems[++i]) ) {
		if ( (' ' + elem.className.replace(rwhitespace, ' ') + ' ').indexOf(name) > -1 ) {
			result.push( elem );
		}
	}

	return result;
}

function byEnable( context, signal ) {
	var elems = tags( 'input,select,option,textarea,button', context ),
		i = -1, result = [], elem;

	while ( (elem = elems[++i]) ) {
		if ( elem.disabled === signal ) {
			result.push( elem );
		}
	}

	return result;
}

function byLink( context, signal ) {
	var elems = tags( 'a,area', context ),
		i = -1, result = [], elem;

	while ( (elem = elems[++i]) ) {
		if ( elem.visited === signal ) {
			result.push( elem );
		}
	}

	return result;
}

function byCheck( context ) {
	var elems = context.getElementsByTagName('input'),
		i = -1, result = [], elem;

	while ( (elem = elems[++i]) ) {
		if ( !!elem.checked ) {
			result.push( elem );
		}
	}

	i = -1;
	elems = context.getElementsByTagName('option');
	while ( (elem = elems[++i]) ) {
		if ( !!elem.selected ) {
			result.push( elem );
		}
	}

	return result;
}

/*
 * Feature/bug detection & init compiler env
 */

function addHandle( attrs, handler ) {
	var arr = attrs.split('|'),
		i = attrs.length;

	while ( i-- ) {
		scope.attrHandle[ arr[i] ] = handler;
	}
}

function nthFunc( code ) {
	return new Function( 'elem, backward, a, b, cache' , CHILD.replace('@', code) );
}

var scope,
	docset = 1,
	uid = 'kqset_' + (new Date()).getTime(),
	scopeCache = createCache(),
	booleans = 'checked|selected|async|autofocus|autoplay|controls|defer|' +
		'disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped';

var CHILD = 'if(b===0){if(a===1){return true;}if(a===0){return false;}}' +
	'var p=elem.parentNode,count=0,name,pos,t;' +
	'if(p&&(p.kqcache!==cache||!elem.kqindex)){' +
	'@ p.kqcache=cache;p.kqcount=count;}' +
	'pos=backward?p.kqcount-elem.kqindex+1:elem.kqindex;' +
	'return a?(pos-b)%a===0:pos===b;';

var nthType = [
	nthFunc( 'name=elem.nodeName;for(t=p.firstElementChild;t;t=t.nextElementSibling){' +
		'if(t.nodeName===name){t.kqindex = ++count;}}' ),
	nthFunc( 'name=elem.nodeName;for(t=p.firstChild;t;t=t.nextSibling){' +
		'if(t.nodeName===name){t.kqindex = ++count;}}' )
];

var nthChild = [
	nthFunc( 'for(t=p.firstElementChild;t;t=t.nextElementSibling){' +
		't.kqindex = ++count;}' ),
	nthFunc( 'for(t=p.firstChild;t;t=t.nextSibling){if(t.nodeType===1){' +
		't.kqindex = ++count;}}' )
];

var contains = [
	function( a, b ) {
		var adown = a.nodeType === 9 ? a.documentElement : a,
			bup = b && b.parentNode;
		return a === bup || !!( bup && bup.nodeType === 1 && (
			adown.contains ?
				adown.contains( bup ) :
				a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
		));
	},
	function( a, b ) {
		if ( b ) {
			while ( (b = b.parentNode) ) {
				if ( b === a ) { return true; }
			}
		}
		return false;
	}
];

function setContext( doc ) {
	if ( isXML(doc) ) {
		return;
	}

	doc = doc.ownerDocument || doc;

	var root = doc.documentElement,
		matches, div, node, rbuggyQSA, rbuggyMatches;

	if ( doc.__kqset__ ) {
		return ( scope = scopeCache[ doc.__kqset__ + ' ' ] );
	} else {
		doc.__kqset__ = ++docset;
	}

	//console.time('setContext');

	scope = {
		id: docset,
		elementSibling: ( 'nextElementSibling' in root ),
		hasAttribute: isNative( root.hasAttribute ),
		hasQSA: isNative( doc.querySelectorAll )
	};

	// NOTE: Windows 8 Native Apps
	// The type attribute is restricted during .innerHTML assignment
	div = doc.createElement('div');
	div.innerHTML = '<a href="#" class="abc e"></a><input class="abc"/>';

	div.className = 'i';
	scope.attributes = !div.getAttribute('className');

	// Opera can't find the second classname (in 9.6)
	// getElementsByClassName return empty
	if ( div.getElementsByClassName && div.getElementsByClassName('e').length ) {
		// Safari caches class attributes, doesn't catch changes (in 3.2)
		div.lastChild.className = "e";
		scope.byClass = div.getElementsByClassName('e').length === 2;
	}

	scope.attrHandle = {};

	// Support: IE<9
	// Use getAttributeNode to fetch booleans when getAttribute lies
	if ( div.getAttribute('disabled') != null ) {
		addHandle( booleans, function( elem, name ) {
			var val;
			return (val = elem.getAttributeNode( name )) && val.specified ?
				val.value : elem[ name ] === true ? name.toLowerCase() : null;
		});
	}

	// IE will return comment node append by javascript
	div.appendChild( doc.createComment('') );
	scope.byTagWithComment = div.getElementsByTagName('*').length > 2;

	// Check if getElementById returns elements by name. IE < 10
	root.appendChild( div ).setAttribute( 'id', uid );
	scope.byId = !doc.getElementsByName || !doc.getElementsByName( uid ).length;
	root.removeChild( div );

	rbuggyQSA = [];
	rbuggyMatches = [];
	// QSA buggy detection
	if ( scope.hasQSA ) {
		div.innerHTML = '<select class="c" id="d"><option selected=""></option></select>';
		// IE9/10 & XML - querySelectorAll return empty for ID/CLASS selector
		if ( !div.querySelectorAll('.c').length ) {
			rbuggyQSA.push( '\\.' + encoding );
		}

		if ( !div.querySelectorAll('#d').length ) {
			rbuggyQSA.push( '#' + encoding );
		}

		// IE8 - Some boolean attributes are not treated correctly
		if ( !div.querySelectorAll('[selected]').length ) {
			rbuggyQSA.push( '\\[' + whitespace + '*(?:value|' + booleans + ')' );
		}

		// :checked should return selected option elements
		// IE8 throws exceptions for some dynamic pseudos
		try {
			if ( !div.querySelectorAll(':checked').length ) {
				rbuggyQSA.push( ':checked' );
			}
		} catch (ex) {}

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
		} catch (ex) {}

		scope.rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join('|') );
	}

	if ( isNative( (matches = root.webkitMatchesSelector ||
		root.mozMatchesSelector ||
		root.oMatchesSelector ||
		root.msMatchesSelector) ) ) {

		scope.matchesSelector = matches;
		// Check to see if it's possible to do matchesSelector
		// on a disconnected node (IE 9)
		scope.disconMatch = matches.call( div, 'div' );

		// This should fail with an exception
		// Gecko does not error, returns false instead
		try {
			matches.call( div, '[s!=""]:x' );
			rbuggyMatches.push( '!=', pseudos );
		} catch (ex) {}

		scope.rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join('|') );
	}

	div = node = null;

	// Priority of selector
	scope.priors = {
		'ID': 5, 'root': 5, 'active': 5,
		'TAG': 4, 'CLASS': scope.byClass ? 4 : 0,
		'link': 3, 'visited': 3, '*': 0,
		'checked': 3, 'enabled': 2, 'disabled': 2
	};

	scope.contains = contains[root.compareDocumentPosition || isNative(root.contains) ? 0 : 1];
	scope.nthChild = nthChild[scope.elementSibling ? 0 : 1];
	scope.nthType = nthType[scope.elementSibling ? 0 : 1];

	//console.timeEnd('time')
	return scopeCache( docset, scope );
}

/*
 * Tokenize component
 */


var shortcuts = {
	'active': 1, 'root': 1, 'link': 1, 'visited': 1,
	'checked': 1, 'enabled': 1, 'disabled': 1
};

var optimas = {' ': 1, '~': 1};

var tokenCache = createCache();

function prechild( m ) {
	// numeric x and y parameters
	// remember that false/true cast respectively to 0/1
	m[3] = +( m[3] ? m[4] + (m[5] || 1) : 2 * ( m[2] === 'even' || m[2] === 'odd' ) );
	m[4] = +( ( m[6] + m[7] ) || m[2] === 'odd' );

	return [ m[0].slice(-4) === 'last', m[1] === 'of-type', m[3], m[4] ];
}

function preattr( m ) {
	m[0] = m[0].replace( runescape, funescape );

	// Move the given value to match[3] whether quoted or unquoted
	m[2] = ( m[3] || m[4] || '' ).replace( runescape, funescape );

	if ( m[1] === '~=' ) {
		m[2] = ' ' + m[2] + ' ';
	}

	return m.slice( 0, 3 );
}

function tokenize( selector, isParser ) {
	var cached = tokenCache[ selector + ' ' ],
		deep = 0, text, matches, group, chunk, token, expr, type;

	if ( cached ) {
		return isParser ? 0 : cached.slice(0);
	}

	//console.time('x')
	text = selector;
	group = [ chunk = [] ];

	while ( text ) {
		// Comma
		if ( (matches = rcomma.exec( text )) ) {
			// Trailing combinator is invalid
			if ( !token || !regexps[token.type] ) { break; }
			// Trailing commas is invalid
			text = text.substr( matches[0].length ) || text;
			deep = 0;
			group.push( chunk = [] );
		}

		expr = false;

		// Combinators
		if ( (matches = rcombinators.exec( text )) ) {
			// Consecutive combinators is invalid
			if ( token && !(token.type in regexps) ) { break; }
			chunk.deep = ++deep;
			expr = matches.shift();
			text = text.substr( expr.length );
			chunk.push(token = {
				text: expr,
				type: matches[0].replace( rtrim, ' ' )
			});
			if ( token.type in optimas ) {
				chunk.optima = true;
			}
		}

		// Filters
		for ( type in regexps ) {
			if ( (matches = regexps[ type ].exec( text )) ) {
				expr = matches.shift();
				text = text.substr( expr.length );

				if ( type === 'ATTR' ) {
					matches = preattr( matches );
				} else if ( type === 'CHILD' ) {
					// nth-* requires argument
					if ( typeof matches[2] === strundef ) {
						query.error( expr );
					}
					matches = prechild( matches );
				} else if ( type === 'PSEUDO' ) {
					if ( matches[0] === 'has' || matches[0] === 'not' ) {
						tokenize( matches[1] );
					}
				}

				if ( type === 'PSEUDO' && matches[0] in shortcuts ) {
					chunk.push(token = {
						type: matches[0],
						text: expr,
						matches: matches
					});
				} else {
					chunk.push(token = {
						type: type,
						text: expr,
						matches: matches
					});
				}
			}
		}

		if ( !expr ) { break; }
	}

	//console.timeEnd('x')
	// Trailing combinator is invalid
	return isParser ? text.length :
		text.length > 0 ? query.error( selector ) :
		tokenCache( selector, group ).slice(0);
}

function dump( chunk ) {
	var selector = '',
		i = 0,
		k = chunk.length;

	for ( ; i < k; i++ ) {
		selector += chunk[i].text;
	}
	return selector;
}

/*
 * Compiler component
 */

var implicted = {type: ' ', text: ' '},
	siblings = {'+': 1, '~': 1},
	operations = {'~=': 1, '^=': 1, '$=': 1, '*=': 1};

var ATTR_INTER = {type: 1, href: 1, height: 1, width: 1};

var ATTR_SPEC = {'class': 'className', 'value': 'value'};

var ATTR_BOOLEAN = {};

var SPEED = 'm=e.kqset||(e.kqset=++k);' +
	'if(t=c@[m]){if(t._){r[l++]=z[i];s._=true;}continue ps;}c@[m]=s;';

var MAIN = 'var v=q.kqcache,k=q.kqset;ps:while((e=z[++i])){@}q.kqset=k;return r;';

var OPERATE = {
	'~=': '(" "+t+" ").indexOf("@")>-1',
	'!=': 't!=="@"',
	'*=': 't.indexOf("@")>-1',
	'^=': 't.indexOf("@")===0',
	'$=': 't.indexOf("@")===(t.length-"@".length)',
	'|=': '(t+"-").indexOf("@-")===0'
};

var finders = {
	'ID': function( id, context, doc ) {
		var elem;

		if ( context.getElementById ) {
			elem = context.getElementById( id );
			elem = elem && elem.parentNode && elem;
		} else {
			elem = doc.getElementById( id );
			elem = elem && scope.contains( context, elem ) && elem;
		}

		return elem && elem.id === id ? [ elem ] : [];
	},
	'TAG': function( name, context ) {
		return context.getElementsByTagName( name );
	},
	'CLASS': function( name, context ) {
		return scope.byClass ?
			context.getElementsByClassName( name ) : byClassRaw( name, context );
	},
	'*': function( name, context ) {
		return scope.byTagWithComment ?
			byTagRaw( context ) : context.getElementsByTagName('*');
	},
	'enabled': function( m, context ) {
		return byEnable( context, false );
	},
	'disabled': function( m, context ) {
		return byEnable( context, true );
	},
	'link': function( m, context ) {
		return byLink( context, false );
	},
	'visited': function( m, context ) {
		return byLink( context, true );
	},
	'checked': function( m, context ) {
		return byCheck( context );
	},
	'active': function( m, context, doc ) {
		var elem = doc.activeElement;
		return elem ? [ elem ] : [];
	},
	'root': function( m, context, doc ) {
		return [ doc.documentElement ];
	}
};

var combinators = {
	' ': function( code, i, def ) {
		def[ 'var c' + i + '={};' ] = 1;
		return 'while((e=e.parentNode)&&e!==c){' + SPEED.replace(/@/g, i) + code + '}';
	},
	'>': function( code, i ) {
		return 'if((e=e.parentNode)&&e!==c){' + code + '}';
	},
	'~': function( code, i, def ) {
		def[ 'var c' + i + '={};' ] = 1;
		return scope.elementSibling ?
			'while((e=e.previousElementSibling)){' + SPEED.replace(/@/g, i) + code + '}' :
			'while((e=e.previousSibling)){if(e.nodeType===1){' +
			SPEED.replace(/@/g, i) + code + '}}';
	},
	'+': function( code, i ) {
		return scope.elementSibling ?
			'if((e=e.previousElementSibling)){' + code + '}' :
			'while((e=e.previousSibling)){if(e.nodeType===1){' + code + 'break;}};';
	}
};

var rootages = {
	' ': function( code ) {
		return code;
	},
	'>': function( code ) {
		return 'if(e.parentNode===c){' + code + '}';
	},
	'~': function( code ) {
		return scope.elementSibling ?
			'p=e;while((e=e.previousElementSibling)){if(e===c){' + code + '}}e=p;' :
			'p=e;while((e=e.previousSibling)){if(e.nodeType===1&&e===c){' +
			code + '}}e=p;';
	},
	'+': function( code ) {
		return scope.elementSibling ?
			'p=e;if((e=e.previousElementSibling)&&e===c){' + code + '}e=p;' :
			'p=e;while((e=e.previousSibling)){if(e.nodeType===1){' +
			'if(e===c){' + code + '}break;}}e=p;';
	}
};

var filters = {
	'ID': function( m ) {
		return 'e.getAttribute("id")==="' + m[0] + '"';
	},
	'CLASS': function( m ) {
		return filters.ATTR( ['class', '~=', m[0]] );
	},
	'TAG': function( m ) {
		return 'e.nodeName==="' + m[0].toUpperCase().replace( runescape, funescape ) + '"';
	},
	'*': function() {
		return '';
	},
	'ATTR': function( m ) {
		var name = '"' + m[0] + '"',
			op = m[1], value, expect;

		if ( !op ) {
			return scope.hasAttribute ?
				'e.hasAttribute(' + name + ')' :
				'(t=e.getAttributeNode(' + name + '))&&t.specified';
		}

		value = 'q.attr(e,' + name + ')';
		expect = m[2];

		if ( op === '=' ) {
			return value + '==="' + expect + '"';
		} else if ( !m[2] && (op in operations) ) {
			return 'false';
		}

		return '(t=' + value + ')&&' + OPERATE[ op ].replace( /@/g, expect );

	},
	'CHILD': function( m ) {
		return m[1] ?
			'u.nthType(e,' + m[0] + ',' + m[2] + ',' + m[3] + ',v)' :
			'u.nthChild(e,' + m[0] + ',' + m[2] + ',' + m[3] + ',v)';
	},
	'PSEUDO': function( m, i, def ) {
		return filters[m[0]]( i, def, m[1], m[2], m[3] );
	},

	'root': function() {
		return 'e===d.documentElement';
	},
	'empty': function() {
		return scope.elementSibling ? 'e.childElementCount===0' : 'q.isEmpty(e)';
	},
	'lang': function( i, def, lang ) {
		return 'e.getAttribute("lang")==="' + lang + '"';
	},
	'link': function() {
		return '(t=e.nodeName)&&(t==="A"||t==="AREA")&&!e.visited';
	},
	'visited': function() {
		return '(t=e.nodeName)&&(t==="A"||t==="AREA")&&e.visited';
	},
	'hover': function() {
		return 'e===d.hoverElement';
	},
	'active': function() {
		return 'e===d.activeElement';
	},
	'focus': function() {
		return 'e===d.activeElement&&(!d.hasFocus||d.hasFocus())&&' +
			'!!(e.type||e.href||~e.tabIndex)';
	},
	'target': function( i, def ) {
		def[ ANCHOR ] = 1;
		return 'a===e.id';
	},
	'enabled': function() {
		return 'e.disabled===false';
	},
	'disabled': function() {
		return 'e.disabled===true';
	},
	'checked': function() {
		return '(t=e.nodeName)&&(t==="INPUT"&&!!e.checked)||(t==="OPTION"&&!!e.selected)';
	},
	'first-child': function() {
		return scope.elementSibling ? '!e.previousElementSibling' : 'q.firstChild(e)';
	},
	'last-child': function() {
		return scope.elementSibling ? '!e.nextElementSibling' : 'q.lastChild(e)';
	},
	'only-child': function() {
		return scope.elementSibling ?
			'!e.previousElementSibling&&!e.nextElementSibling' :
			'q.lastChild(e)&&q.firstChild(e)';
	},
	'first-of-type': function() {
		return 'q.firstType(e)';
	},
	'last-of-type': function() {
		return 'q.lastType(e)';
	},
	'only-of-type': function() {
		return 'q.lastType(e)&&q.firstType(e)';
	},
	'has': function( i, def, selector ) {
		return '(q.kqset=k,t=q("' + selector + '",e),k=q.kqset,t.length>0)';
	},
	'not': function( i, def, selector ) {
		var chunk = tokenize( selector ),
			l = -1, dir = 0, cond = [],
			part, token, items, item, k;

		while ( (part = chunk[++l]) ) {
			if ( !part.deep ) {
				k = -1;
				items = [];
				while ( (token = part[++k]) ) {
					if ( (item = filters[token.type]( token.matches, i, def )) ) {
						items.push( item );
					}
				}
				items.length && cond.push( '!(' + items.join('&&') + ')' );
			} else if ( !(part[0].type in regexps) ) {
				cond.push( 'false' );
			} else {
				++dir;
				def[ 'var g' + dir + '=q.hash(q("' + dump(part) + '",d));' ] = 1;
				cond.push( '!g' + dir + '[e.kqset||(e.kqset=++k)]' );
			}
		}

		return cond.length ? cond.join('&&') : '';
	},
	'contains': function( i, def, text ) {
		return scope.elementSibling ?
			'e.textContent.indexOf("' + text + '")>-1' :
			'e.innerText.indexOf("' + text + '")>-1';
	}
};

var compilerCache = {};

function compile( selector, chunk, deep, optima ) {
	var cache = compilerCache[scope.id],
		i, token, type, code, def, item, items, dir;

	if ( !cache ) {
		cache = compilerCache[scope.id] = createCache();
	} else if ( (item = cache[ selector + ' ' ]) ) {
		return item;
	}

	//console.time('compile')
	dir = 1;
	def = {};
	items = [];

	type = chunk[0].type;
	i = type in combinators ? 1 : 0;
	code = optima ? 'r[l++]=e;s._=true;continue ps;' : 'r[l++]=e;continue ps;';
	code = rootages[ i === 1 ? type : ' ' ]( code );

	while ( (token = chunk[i++]) ) {
		type = token.type;

		if ( (item = combinators[type]) ) {
			if ( items.length ) {
				code = 'if(' + items.join('&&') + '){' + code + '}';
				items = [];
			}

			dir += 1;
			code = 'var n' + dir + '=e;' + item( code, dir, def ) + 'e=n' + dir + ';';
		} else if ( (item = filters[type](token.matches, dir, def)) ) {
			items.push( item );
		}
	}

	if ( items.length ) {
		code = 'if(' + items.join('&&') + '){' + code + '}';
	}

	code = MAIN.replace( '@', optima ? 'var s={_:false};' + code : code );
	code = 'var r=[],i=-1,l=0,e=c,p,t,m;' + code;
	for ( item in def ) { code = item + code; }

	//console.timeEnd('compile')
	return cache( selector, new Function('z,c,d,u,q', code) );
}

function query( selector, context, doc, discon ) {
	var i = -1,
		result = [],
		chunk = tokenize( selector ),
		j, index, part, token, seed, type, deep, optima;

	while ( (part = chunk[++i]) ) {
		type = part[0].type;
		if ( discon && type in siblings ) {
			continue;
		}

		if ( part.length === 1 && type in finders ) {
			seed = finders[type]( part[0].matches[0], context, doc );
			push.apply( result, seed );
			continue;
		}

		query.kqcache++;
		deep = part.deep | 0;
		deep = (type in regexps) ? ++deep : deep;
		optima = part.optima;
		seed = false;
		part = part.slice(0);
		j = part.length;
		index = -1;

		while ( (token = part[--j]) ) {
			if ( token.type in combinators ) {
				break;
			}

			token.prior = scope.priors[token.type] | 0;
			if ( !seed || token.prior > 0 && token.prior > seed.prior ) {
				seed = token;
				index = j;
			}
		}

		if ( index > -1 ) { part.splice( index, 1 ); }
		seed = seed ? finders[seed.type]( seed.matches[0], context, doc ) :
			byTagRaw( context );
		if ( part.length && seed.length ) {
			index = compile( dump(part), part, deep, optima );
			//console.log(index);
			seed = index( seed, context, doc, scope, query );
		}

		push.apply( result, seed );
	}

	return result;
}

query.kqset = query.kqcache = 1;

query.attr = function( elem, name ) {
	var val;

	if ( name in ATTR_INTER ) {
		return elem.getAttribute( name, 2 ) || '';
	} else if ( name in ATTR_SPEC ) {
		return elem[ ATTR_SPEC[name] ] || '';
	} else if ( name in ATTR_BOOLEAN ) {
		return (val = elem.getAttributeNode( name )) && val.specified ?
			val.value : elem[ name ] === true ? name : 'false';
	}

	return scope.attributes ? elem.getAttribute( name ) || '' :
		(val = elem.getAttributeNode(name)) && val.specified ? val.value : '';
};

query.error = function( text ) {
	throw new Error( 'Syntax error: ' + text );
};

query.hash = function( nodeList ) {
	var cached = nodeList.kqset, i, kq, it;

	if ( !cached ) {
		i = nodeList.length;
		kq = query.kqset;

		cached = nodeList.kqset = {};
		while ( i-- ) {
			it = nodeList[i];
			cached[ it.kqset || (it.kqset = ++kq) ] = true;
		}
		query.kqset = kq;
	}

	return cached;
};

query.isEmpty = function( elem ) {
	for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
		if ( elem.nodeName > "@" || elem.nodeType === 3 || elem.nodeType === 4 ) {
			return false;
		}
	}
	return true;
};

query.firstChild = function( elem ) {
	while ( (elem = elem.previousSibling) ) {
		if ( elem.nodeType === 1) { return false; }
	}
	return true;
};

query.lastChild = function( elem ) {
	while ( (elem = elem.nextSibling) ) {
		if ( elem.nodeType === 1) { return false; }
	}
	return true;
};

query.firstType = function( elem ) {
	var name = elem.nodeName;
	while ( (elem = elem.previousSibling) ) {
		if ( elem.nodeName === name) { return false; }
	}
	return true;
};

query.lastType = function( elem ) {
	var name = elem.nodeName;
	while ( (elem = elem.nextSibling) ) {
		if ( elem.nodeName === name) { return false; }
	}
	return true;
};

function kquery( selector, context ) {
	var i, result, nodeType, doc, m, match,
		group, newContext, newSelector, nid, old;

	context = context || document;
	doc = context.ownerDocument || context;

	if ( !selector || typeof selector !== "string" ) {
		return [];
	}

	if ( (nodeType = context.nodeType) !== 1 && nodeType !== 9 ) {
		return [];
	}

	setContext( doc );

	if ( (match = rquickExpr.exec( selector )) ) {
		// Speed-up: #ID
		if ( (m = match[1]) ) {
			return finders['ID']( m, context, doc );
		// Speed-up:TAG
		} else if ( match[2] ) {
			if ( selector === '*' && scope.byTagWithComment ) {
				return byTagRaw( context );
			}
			return finders['TAG']( selector, context, doc );
		// Speed-up: .CLASS
		} else if ( (m = match[3]) ) {
			return finders['CLASS']( m, context, doc );
		}
	}

	if ( scope.hasQSA && (!scope.rbuggyQSA || !scope.rbuggyQSA.test( selector )) ) {
		nid = old = uid;
		newContext = context;
		newSelector = nodeType === 9 && selector;

		// qSA works strangely on Element-rooted queries
		// We can work around this by specifying an extra ID on the root
		// and working up from there (Thanks to Andrew Dupont for the technique)
		// IE 8 doesn't work on object elements
		if ( nodeType === 1 && context.nodeName.toLowerCase() !== 'object' ) {
			group = tokenize( selector );

			if ( (old = context.getAttribute('id')) ) {
				nid = old.replace( rescape, '\\$&' );
			} else {
				context.setAttribute( 'id', nid );
			}
			nid = '[id="' + nid + '"] ';

			i = group.length;
			while ( i-- ) {
				group[i] = nid + dump( group[i] );
			}
			newContext = doc;
			newSelector = group.join(',');
		}

		if ( newSelector ) {
			try {
				push.apply( result, newContext.querySelectorAll( newSelector ) );
				return result;
			} catch(ex) {} finally {
				if ( !old ) {
					context.removeAttribute('id');
				}
			}
		}
	}

	m = nodeType === 9 || !context.parentNode;
	return query( selector.replace( rtrim, '$1' ), context, doc, m );
}

kquery.version = version;

kquery.about = function() {
	alert( 'KQuery - A Super Fast and Compatible CSS Selector Engine\n' +
		'author: aaron.xiao\nemail: admin@veryos.com\n' +
		'version: ' + version );
};

kquery.compile = function( selector, doc ) {
	var group = tokenize( selector ),
		i = group.length, part, cache;

	setContext( doc || document );
	if ( i === 1 ) {
		part = group[0];
		return compile( selector, part.slice(0), part.deep, part.optima );
	}

	cache = compilerCache[scope.id] || (compilerCache[scope.id] = createCache());

	while ( i-- ) {
		part = group[i]; 
		group[i] = compile( selector, part.slice(0), part.deep, part.optima );
	}

	return cache(selector, function( z, c, d, u, q) {
		var i = -1, reuslt = [], select, tmp;

		while ( (select = group[++i]) ) {
			tmp = select( z, c, d, u, q );
			if ( tmp.length ) {
				push.apply( result, tmp );
			}
		}

		return result;
	});
};

kquery.filter = function( seed, selector ) {
	var doc = seed[0].ownerDocument || document;
	setContext( doc );
	return kquery.compile( selector, doc )( seed, doc, doc, scope, query );
};

kquery.attr = function( elem, name ) {
	return isXML( elem ) ? elem.getAttribute( name ) : query.attr( elem, name );
};

kquery.match = function( elem, selector ) {
	var expr = selector.replace( rattributeQuotes, '="$1"]' );

	setContext( elem );
	if ( scope.matchesSelector &&
		( !scope.rbuggyMatches || !scope.rbuggyMatches.test( expr ) ) &&
		( !scope.rbuggyQSA     || !scope.rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = scope.matchesSelector.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || scope.disconMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch(e) {}
	}

	return kquery.filter( [elem], selector ).length > 0;
};

tokenize('div p a');
setContext( document );

if ( typeof define === 'function' && define.amd ) {
	define(function() { return kquery; });
} else {
	window.kquery = kquery;
}

})( window );