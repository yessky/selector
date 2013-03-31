/*
 * kquery - a super fast and compatible CSS selector engine
 * Copyright (C) 2011 - 2013 aaron.xiao
 * Author: aaron.xiao <admin@veryos.com>
 * Version: 2.0
 * Release: 2013/03/31
 * License: http://kquery.veryos.com/MIT-LICENSE
 * Credits: 
 * Q.js - https://github.com/hackwaly/Q
 *   - the idea of compile system
 * Sizzle.js - http://sizzlejs.org
 *   - qsa buggy detection
 */

(function( window, undefined ) {

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
	groups = "(?=[^\\x20\\t\\r\\n\\f])(?:\\\\.|" + attributes
		+ "|(" + identifier + "?)(" + tags + ")(?:" + pseudos + ")?|[^\\\\(),])+",
	matches = "(?:" + attributes + "(?!" + tags + "))|(" + identifier + "?)("
		+ tags + ")(?:" + pseudos + "(?!" + tags + "))?|(?:" + combinators + ")",

	rwhitespace = new RegExp( whitespace + "+" ),
	rpos = /([+\-]?)(\d*)(?:n([+\-]?\d*))?/,
	rsibling = /^[\x20\t\r\n\f]*[+~]/,
	rgroups = new RegExp( groups + "?(?=" + whitespace + "*,|$)", "g" ),
	rquickExpr = /^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,
	rmatches = new RegExp( matches, "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)"
		+ whitespace + "+$", "g" ),
	rescape = /'|\\/g,
	rattributeQuotes = /\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,

	tarray = [],
	push = tarray.push,
	slice = tarray.slice,
	push_native = tarray.push,

	strundefined = typeof undefined,
	hasDuplicate = false,
	queryHas,
	queryEngine;

try {
	push.apply(
		(tarray = slice.call( document.childNodes )),
		document.childNodes
	);
} catch ( e ) {
	push = { apply: tarray.length ?
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

function mixin(accepter, sender) {
	var key;
	for ( key in sender ) { accepter[key] = sender[key]; }
	return accepter;
}

function isXML( node, numeric ) {
	var r = (node ? node.ownerDocument || node : 0).documentElement,
		x = r ? r.nodeName !== 'HTML' : false;
	return numeric ? Number( x ) : x;
}

// === key-value cache ===
function queryCache( len ) {
	var keys = [], cache;

	return (cache = function( key, value ) {
		if ( keys.push( key += " " ) > len ) {
			delete cache[ keys.shift() ];
		}
		return ( cache[ key ] = value );
	});
}

// === Features/Bugs detection for HTML/XML Document ===
queryHas = function( cur ) {
	var sid = 'x-' + ( new Date().getTime() ),
		data = '<html></html>',
		xdoc = isXML( cur ),
		has = [{}, {}], doc;

	// init a html document
	if ( xdoc ) {
		if ( cur.implementation ) {
			doc = cur.implementation.createHTMLDocument( '#' );
		} else {
			var acxo = new ActiveXObject( 'htmlfile' );

			acxo.open();
			acxo.write( '<html><head></title></title></head><body>' );
			acxo.write( '<iframe src="about:blank" id="win"></iframe>' );
			acxo.write( '</body></html>' );
			acxo.close();

			doc = acxo.getElementById( 'win' ).contentWindow.document;
		}
	}
	// init a xml document
	else {
		if ( window.DOMParser ) {
			doc = new DOMParser().parseFromString( data , "text/xml" );
		} else {
			doc = new ActiveXObject( "Microsoft.XMLDOM" );
			doc.async = "false";
			doc.loadXML( data );
		}
	}

	function isNative( fn ) {
		return ( fn + '' ).indexOf( '[native code]' ) !== -1;
	}

	function assert( doc, fn ) {
		var div = doc.createElement("div");

		try {
			return fn( div );
		} catch ( e ) {
			return false;
		} finally {
			div = null;
		}
	}

	function siblingCheck( a, b ) {
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
	}

	function initDocument( doc, x ) {
		var byid = 'getElementById' in doc,
			root = doc.documentElement,
			support = has[ x ];

		function createNode( wrapper, prop ) {
			var node = doc.createElement( prop.name ),
				attrs = prop.attrs, key;

			for ( key in attrs ) { node.setAttribute( key, attrs[key] ); }
			wrapper.appendChild( node );
		}

		// Features detection
		mixin(support, {
			qsa: isNative( doc.querySelectorAll ),
			docPos: 'compareDocumentPosition' in root,
			textContent: 'textContent' in root,
			hasAttribute: isNative( root.hasAttribute ),
			byId: byid,
			byElement: 'firstElementChild' in root,
			byChildren: 'children' in root,
			byChildrenTag: ('children' in root) && ('tags' in root.children),
			byClass: assert(doc, function( div ) {
				createNode( div, {name: 'div', attrs: {'class': 'hidden e'}} );
				createNode( div, {name: 'div', attrs: {'class': 'hidden'}} );
				// Opera can't find the second classname (in 9.6)
				if ( !div.getElementsByClassName ||
					div.getElementsByClassName('e').length === 0 ) {
					return false;
				}
				// Safari caches class attributes, doesn't catch changes (in 3.2)
				div.lastChild.setAttribute( 'class', 'e' );
				return div.getElementsByClassName('e').length !== 1;
			}),
			byTagId: assert(doc, function( div ) {
				createNode( div, {name: 'a', attrs: {'name': sid}} );
				createNode( div, {name: 'div', attrs: {'id': sid}} );
				var node = div.getElementsByTagName('*')[sid],
					pass = false;
				// IE returns HTMLCollection in html document.
				if ( node && node.length > 1) {
					pass = true;
					node = node[1];
				}

				support.buggyByTagId = pass;
				return node === div.lastChild;
			}),
			byTagWithComment: assert(doc, function( div ) {
				div.appendChild( doc.createComment('') );
				return div.getElementsByTagName('*').length !== 0;
			}),
			byName: assert(doc, function( div ) {
				div.setAttribute( 'id', sid + 0 );
				createNode( div, {name: 'a', attrs: {'name': sid}} );
				createNode( div, {name: 'div', attrs: {'name': sid}} );
				root.insertBefore( div, root.firstChild );

				var pass = 'getElementsByName' in doc &&
					// buggy browsers will return fewer than the correct 2
					doc.getElementsByName( sid ).length === 2 +
					// buggy browsers will return more than the correct 0
					doc.getElementsByName( sid + 0 ).length;

				support.buggyById = byid && !!doc.getElementById( sid );
				root.removeChild( div );
				return pass;
			})
		});

		support.contains = support.docPos ? function( a, b ) {
			return !!(a.compareDocumentPosition(b) & 16);
		} : root.contains ? function( a, b ) {
		    return a !== b && (a.contains ? a.contains(b) : true);
		} : function( a, b ) {
			while ( (b = b.parentNode) ) {
				if ( a === b ) { return true; }
			}
			return false;
		};

		support.sortOrder = support.docPos ? function( a, b ) {
			if ( a === b ) {
				hasDuplicate = true;
				return 0;
			}

			return ( !a.compareDocumentPosition || !b.compareDocumentPosition ?
				a.compareDocumentPosition :
				a.compareDocumentPosition(b) & 4
			) ? -1 : 1;
		} : ( 'sourceIndex' in root ) ? function( a, b ) {
			return a.sourceIndex - b.sourceIndex > 0 ? 1 : -1;
		} : function( a, b ) {
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
		};

		if ( !x && support.qsa ) {
			var rbuggyQSA = [ ':focus' ], rbuggyMatches = [];

			assert(doc, function( div ) {
				// Select is set to empty string on purpose
				// This is to test IE's treatment of not explictly
				// setting a boolean content attribute,
				// since its presence should be enough
				div.innerHTML = "<select><option selected=''></option></select>";

				// IE8 - Some boolean attributes are not treated correctly
				if ( !div.querySelectorAll("[selected]").length ) {
					rbuggyQSA.push( "\\[" + whitespace + "*(?:checked|disabled|ismap|multiple|readonly|selected|value)" );
				}

				// Webkit/Opera - :checked should return selected option elements
				// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
				// IE8 throws error here and will not see later tests
				if ( !div.querySelectorAll(":checked").length ) {
					rbuggyQSA.push(":checked");
				}
			});

			assert(doc, function( div ) {
				// Support: Opera 10-12/IE8
				// ^= $= *= and empty values
				// Should not select anything
				// Support: Windows 8 Native Apps
				// The type attribute is restricted during .innerHTML assignment
				var input = document.createElement("input");
				input.setAttribute("type", "hidden");
				div.appendChild( input ).setAttribute( "i", "" );

				if ( div.querySelectorAll("[i^='']").length ) {
					rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:\"\"|'')" );
				}

				// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
				// IE8 throws error here and will not see later tests
				if ( !div.querySelectorAll(":enabled").length ) {
					rbuggyQSA.push( ":enabled", ":disabled" );
				}

				// Opera 10-11 does not throw on post-comma invalid pseudos
				div.querySelectorAll("*,:x");
				rbuggyQSA.push(",.*:");
			});

			if ( isNative( (matches = root.webkitMatchesSelector ||
				root.mozMatchesSelector ||
				root.oMatchesSelector ||
				root.msMatchesSelector) ) ) {

				support.matches = matches;
				assert(doc, function( div ) {
					// Check to see if it's possible to do matchesSelector
					// on a disconnected node (IE 9)
					support.disconnectedMatch = matches.call( div, "div" );

					// This should fail with an exception
					// Gecko does not error, returns false instead
					matches.call( div, "[s!='']:x" );
					rbuggyMatches.push( "!=", pseudos );
				});
			}

			mixin(support, {
				rqsaBugs: new RegExp( rbuggyQSA.join("|") ),
				rmatchBugs: rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") )
			});
		}
	}

	initDocument( cur, xdoc ? 1 : 0 );
	initDocument( doc, xdoc ? 0 : 1 );

	return function( x ) { return has [ x ]; };
}( document );

// === Query engine ===
queryEngine = function() {
	var diruns = 0,
		envs = [ 0, 0 ],
		queries = [ 0, 0 ],
		compilers = [ 0, 0 ],

		// Priority defination
		rfinders = {'#': 10, '>T': 8, 'N': 7, '.': 6},
		vtesters = {
			'#': 9, '=': 9, 'N': 9,
			'[': 8, 'T': 8, '.': 5,
			'~=': 3, '|=': 3, '*=': 3,
			':not': 6, ':has': 1, ':contains': 3, ':not-ex': 7,
			':nth-child': 2, ':nth-last-child': 2,
			':first-child': 3, ':last-child': 3, ':only-child': 3
		},
		vunique = {'#': 1, ':root': 1, '+': 1, '>': 1, '~': 1, '>T': 1},
		vclass = {'class': 1, 'className': 1},
		vprops = {'for': '${N}.htmlFor', 'class': '${N}.className'},
		vuri = {
			'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
			'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
		},

		newFun = function( args, fn, prop ) {
			return new Function( args, format(fn, prop) );
		},
		format = function( template, props ) {
			return template.replace(/\$\{([^\}]+)\}/g, function(m, p) {
				 return props[p] == null ? m : props[p] + '';
			});
		},
		make = function( type, array ) {
			array._type = type;
			return array;
		},
		sorter = function ( a, b ) {
			return a._tr - b._tr;
		};

	// Parse selector to internal format
	var tokenize = function() {
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
						c.length === 1 && q.length === 0 && error();
						g.push( c = [ q = [] ] );
					} 
					// Invalid combination  div + + div
					else {
						q.length === 0 && q._union && error();
						c.length === 1 && q.length && ( q._union = q._union || " " );
						(c.length > 1 || c.length === 1 && q.length) && c.push( q = [] );
						q._union = m[8].replace( rwhitespace, " " );
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
			return (
				text = expr, index = 0, expr = parse(),
				match( /\s*/g ), index < text.length ? error() : expr
			);
		};
	}();

	function Compiler( x ) {
		mixin(this, {
			isXML: !!x,
			vars: envs[ x ],
			has: queryHas( x ),
			query: queries[ x ],
			_compile: queryCache(25),
			_tokenize: queryCache(25)
		});
	}

	Compiler.prototype = {
		// Clean-up selector
		// 1. merge attributes/class selector etc.
		// 2. sort selector for filtering.
		// 3. figure out the fastest selector.
		sanitize: function( queue ) {
			var isHTML = !this.isXML,
				finders = this.vars.finders,
				i = 0, single, fastq, sclass;

			for ( ; single = queue[i]; i++ ) {
				var stype = single._type,
					sattr = single[0],
					sval = single[1], temp;

				switch ( stype ) {
					case '=':
						if ( sval ) {
							// [name='xxx'] ===> getElementsByName('xxx')
							if ( sattr === 'name' ) {
								single = make( 'N', [sval] );
							}
							// [id='xxx'] ==> #xxx
							else if ( sattr === 'id' ) {
								single = make( '#', [sval] );
							}
							// [class='xxx'] ==> .xxx
							// [className='xxx'] ==> .xxx
							// note: XML DOCUMENT does not support getElementsByClassName
							else if ( isHTML && vclass[ sattr ] ) {
								single = make( '.', [sval] );
							}
						}
						break;
					// [class~="xxx"] ===> .xxx
					// [className~="xxx"] ===> .xxx
					case '~=':
						if ( isHTML && sval && vclass[ sattr ] ) {
							single = make( '.', [sval] );
						}
						break;
					case 'T':
						// *.class | *[xxx]
						if ( sattr === '*' ) {
							single._type = '*';
						}
						// >T
						else if ( queue._union == '>' ) {
							queue._tag = single;
						}
						break;
					// :not(a b) ===> :not-ex(a b)
					case ':not':
						//TODO: Optmize selectors like 'div:not(div)', 'div:not(span)'
						//TODO: Investigate if need to optmize div:has(div) div
						if ( !((temp = sattr, temp.length === 1) &&
							(temp = temp[0], temp.length === 1)) ) {
							single._type = ':not-ex';
						}
						break;
				}

				stype = single._type;
				// Merge .class.class2
				if ( isHTML && stype === '.' ) {
					if ( !sclass ) {
						sclass = single;
					} else {
						sclass.push( single[0] );
						stype = single._type = '*';
						queue.splice( i--, 1 );
					}
				}

				single._pri =  finders[ stype ] | 0;
				single._tr = vtesters[ stype ] | 0;

				// Figure out the fastest selector
				if ( !fastq || single._pri > fastq._pri ) {
					fastq = single;
				}

				if ( stype !== '*' ) { queue[i] = single; }
			}

			return ( queue.sort(sorter), queue.$ = fastq, queue );
		},
		// Figure out seed selector
		compute: function( token ) {
			var finders = this.vars.finders,
				has = this.has,
				len = token.length,
				i = 0, queue, prev, seed;

			for ( ; i < len; i++ ) {
				queue = this.sanitize( token[i] );
				queue.N = '_n' + i;
				prev = token[ i - 1 ];
				queue.R = prev ? prev.N : 'root';

				if ( !seed || queue.$._pri > seed._pri ) {
					seed = queue.$;
					token._index = i;
				}
			}

			i = token._index === 0 ? 0 : token._index + 1;

			for ( ; i < len; i++ ) {
				queue = token[i];
				seed = queue.$;

				// >T is faster
				if ( has.byChildrenTag && queue._union === '>' && 
					typeof( queue._tag ) !== strundefined &&
					finders['>T'] > seed._pri ) {
					seed = queue.$ = make( '>T', [queue._tag[0]] );
					queue._tag._type = '*';
				}
				// Combination selector is faster
				else if ( finders[ queue._union ] > seed._pri ) {
					seed = queue.$ = make( queue._union, [] );
				}

				// No priority selector, use native getElementsByTagName('*')
				if ( seed._pri === 0 && seed._type !== '*' ) {
					seed = queue.$ = make( '*', ['*'] );
					queue.push( seed );
				}
			}

			// Check case "query('#id', root)", root is document.
			// to make sure that element(#id) is the root's descendant.
			// TODO: check this logic if it is required
			if ( !has.byTagID ) {
				token[0]._check = token[ token._index ].$._type === '#';
			}

			return token;
		},
		// Compile experssion to executable functions
		compile: function( expr ) {
			var smain = this.vars.main,
				sequnce = this._compile[ expr + ' ' ],
				i, tokens, token, done;

			if ( sequnce ) { return sequnce; }

			tokens = this._tokenize[ expr + ' ' ] ||
				this._tokenize( expr, tokenize( expr ) );
			i = tokens.length;
			sequnce = [];

			while ( i-- ) {
				var token = tokens[ i ],
					code = this.build( token ),
					shash = {}, svars = [];

				// Define variables at the beginning of function statement
				code = code.replace(/\/\*\^(.*?)\^\*\//g, function( m, p ) {
					return ( shash[p] || ( shash[p] = svars.push(p) ), '' );
				});
				code = format( smain, {X: svars.join('') + code + ''} );

				done = new Function( 'query', 'return (' + code + ');' );
				sequnce.unshift( done(this.query) );
			}

			return this._compile( expr, sequnce );
		},
		build: function( token ) {
			( diruns = 0, token = this.compute( token ) );

			var index = token._index,
				code = this.find( token[index], 1, token[index + 1] ),
				next = this.right( token, this.vars.push );

			if ( index > 0 ) {
				next = format( this.left(token), {Y: next} );
			}

			return format( code, {X: next} );
		},
		// Find the seed nodes
		find: function( queue, seed, nextq ) {
			var fastq = queue.$,
				type = fastq._type,
				code = this.vars.find[ type ],
				val = type === '.' ? fastq.shift() : fastq[0];

			// '>' is faster, byChildren is false, need check nodeType
			if ( type === '>' && !this.has.byChildren ) {
				queue.push( make(':element', []) );
			}

			// Skip seed selector
			if ( type !== '.' || fastq.length === 0 ) {
				fastq._type = '*';
				fastq._orig = type;
			}

			code = format(code, {
				P: val,
				N: queue.N,
				R: seed ? 'root' : queue.R,
				X: this.then( queue )
			});

			// Optimize to avoid unnecessary loop
			if ( nextq && !vunique[ type ] && !vunique[ nextq.$._type ] ) {
				next = format( this.vars.strip, {N: queue.N} );
				code = format( code, {X: next} );
			}

			return code;
		},
		// Filter descendants
		right: function( token, then ) {
			var index = token._index + 1,
				count = token.length,
				code = '${X}',
				prevq = token[ index - 1 ],
				lastq = token[ token.length - 1 ],
				svunique = this.vars.unique,
				queue, block, next;

			for ( ; index < count; index++ ) {
				queue = token[ index ];
				block = this.find( queue, 0, token[index + 1] );
				code = format( code, {X: block} );

				// Avoid duplicate node
				if ( !vunique[ queue.$._orig ] && vunique[ prevq.$._orig ] ) {
					next = format( svunique, {N: queue.N} );
					code = format( code, {X: next} );
				}

				prevq = queue;
			}

			next = format( then, {N: lastq.N} );
			code = format( code, {X: next} );

			return code;
		},
		// Filter ancestors
		left: function( token ) {
			var code = this.vars.left,
				index = token._index - 1,
				prev, queue, last;

			// TODO: optimize div #title
			for ( ; index > -1; index-- ) {
				queue = token[ index ];
				last = token[ index + 1 ];
				prev = this.pass( queue, last.N, last._union );
				code = format( code, {X: prev} );
			}

			code = format( code, {X: this.vars.loopbreak} );
			code = format( code, {R: token[0].R} );

			return code;
		},
		pass: function( queue, term, union ) {
			return format(this.vars.combs[ union ], {
				N: queue.N,
				C: term,
				X: this.then( queue )
			});
		},
		then: function( queue ) {
			var code = this.filter( queue );

			code = code ? 'if(' + code + '){${X}}' : '';
			if ( queue._check ) {
				code = format( code, {X: this.vars.rel[queue._union]} );
			}
			return code ? format( code, {N: queue.N} ) : '${X}';
		},
		filter: function( queue ) {
			var len = queue.length,
				strcode = [], code;

			while ( len-- ) {
				if ( code = this.test(queue[len]) ) {
					strcode.push( code );
				}
			}

			return strcode.join( ' && ' );
		},
		test: function( singleq ) {
			var type = singleq._type,
				sval = singleq[0],
				temp;

			if ( type.indexOf( '=' ) > -1 ) {
				singleq.A = this.attr( singleq[0] );
			}

			switch( type ) {
				case '.':
					var len = singleq.length,
						strcode = [];

					if ( len === 0 ) { return ''; }
					while ( len-- ) {
						strcode.push( 't.indexOf(" ${'+ len +'} ")!==-1' );
					}

					temp = '(t=' + this.attr( 'class' ) + ')&&((t=" "+t+" "),('
						+ strcode.join( ' && ' ) + '))';
					return format( temp, singleq );
				case ':not':
					temp = this.filter( sval[0][0] );
					return temp ? '!(' + temp + ')' : 'false';
				case ':not-ex':
				case ':has':
					singleq.G = diruns++;
					break;
				case ':nth-child':
				case ':nth-last-child':
				case ':nth-of-type':
				case ':nth-last-of-type':
					// TODO: move out
					singleq[0] = sval === 'even' ?
						'2n' : ( sval === 'odd' ? '2n+1' : sval );
					temp = rpos.exec( singleq[0] );
					singleq[1] = ( temp[1] + (temp[2] || 1) ) - 0;
					singleq[2] = temp[3] - 0;
					break;
				default:
					break;
			}

			return format( this.vars.filter[type], singleq );
		},
		// Get non-normalized attributes
		attr: function( name ) {
			if ( this.isXML ) {
				return '${N}.getAttribute("' + name + '")'
			}

			if ( vuri[name] ) {
				return '${N}.getAttribute("' + name + '",2)||""';
			}

			return vprops[ name ] ||
				( '(${N}.getAttribute("' + name + '")||${N}["' + name + '"])' );
		}
	};

	function uniqueSort( results, sortOrder ) {
		var dups = [], j = 0, i = 0, elem;

		sortOrder && results.sort( sortOrder );

		if ( hasDuplicate ) {
			while ( (elem = results[i++]) ) {
				if ( elem === results[ i ] ) {
					j = dups.push( i );
				}
			}
			while ( j-- ) {
				results.splice( dups[ j ], 1 );
			}
			hasDuplicate = false;
		}

		return results;
	}

	function init( x ) {
		var has = queryHas( x ),
			num = Number( has.byElement ),
			strvdoc = '/*^var doc=root.ownerDocument||root;^*/',
			strvcontains = has.docPos ?
				'${0}.compareDocumentPosition(${1})&16' :
				'${0}.contains(${1})',
			strvhash = '${N}.veroset||(${N}.veroset=++done)',
			vars = {
				vdoc: strvdoc,
				vlink: '/*^var tag_a=xml?"a":"A";^*/',
				main: 'function(root, xml){var result=[];'
					+ 'var done=query.veroset,t,l=result.length;'
					+ 'BQ:{${X}}query.veroset=done;return result;}',
				left: 'var ${R}V={_:false};NP_${R}:{P_${R}:{${X}break NP_${R};}'
					+ '${R}V._=true;${Y}}',
				strip: '/*^var ${N}l;^*/if(!${N}l||!('
					+ format( strvcontains, ['${N}l', '${N}'] ) +')){${X}${N}l=${N};}',
				unique: '/*^var ${N}h={};^*/if(${N}h[' + strvhash + '])break;'
					+ '${N}h[' + strvhash + ']=1;${X}',
				loopbreak: 'break P_${R};',
				push: 'result[l++]=${N};'
			}, query;

		// Combination filter
		var strvmain = 'if(t=${N}h[' + strvhash + ']){if(t._){break P_${R};}'
			+ 'else{break NP_${R};}}${N}h[' + strvhash + ']=${R}V;${X}',
			strvtest = format( strvmain, {X: 'if(${N}!==${R}){${X}}'} );

		mixin(vars, {combs: {
			'>': '/*^var ${N}h={};^*/var ${N}=${C}.parentNode;' + strvtest,
			' ': '/*^var ${N}h={};^*/var ${N}=${C};'
				+ 'while(${N}=${N}.parentNode){' + strvtest + '}',
			'+': num ?
				'/*^var ${N}h={};var ${N};^*/if(${N}=${C}.previousElementSibling){${X}}' :
				'/*^var ${N}h={};^*/var ${N}=${C};'
				+ 'while(${N}=${N}.previousSibling){if(${N}.nodeType===1){${X}break;}}',
			'~': num ?
				'/*^var ${N}h={};^*/var ${N}=${C};'
				+ 'while(${N}=${N}.previousElementSibling){' + strvmain + '}' :
				'/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling)'
				+ '{if(${N}.nodeType===1){' + strvmain + '}}'
		}});

		// Seed selectors
		var strvloop = 'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
			strvform = strvdoc + 'var ${N}a='
				+ 'query("input,select,textarea,option",doc,null,xml);'
				+ 'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){',
			strvelem = has.byTagWithComment ? 'if(${N}.nodeType===1){${X}}' : '${X}',
			strvtags = 'var ${N}a=${R}.getElementsByTagName("*");'
				+ format( strvelem, {X: strvloop} ),
			strvlinks = 'var ${N}a=${R}.getElementsByTagName("a");' + strvloop;

		mixin(vars, {find: {
			'#': strvdoc + 'var ${N}=query.byId("${P}",${R},doc);if(${N}){${X}}',
			'N': strvdoc + '/*^var isdoc=${R}===doc;^*/'
				+ 'var ${N}a=doc.getElementsByName("${P}");'
				+ 'for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){if(isdoc||'
				+ format( strvcontains, ['${R}', '${N}'] ) + '){${X}}}',
			'T': 'var ${N}a=${R}.getElementsByTagName("${P}");' + strvloop,
			'.': 'var ${N}a=${R}.getElementsByClassName("${P}");' + strvloop,
			'*': strvtags,
			'[': strvtags,
			'+': num ?
				'/*^var ${N};^*/if(${N}=${R}.nextElementSibling){${X}}' :
				'var ${N}=${R};while(${N}=${N}.nextSibling){'
				+ 'if(${N}.nodeType===1){${X}break;}}',
			'~': num ?
				'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextElementSibling){'
				+ 'if(${N}h[' + strvhash + '])break;${N}h[' + strvhash + ']=1;${X}}' :
				'/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextSibling){'
				+ 'if(${N}.nodeType===1){if(${N}h[' + strvhash + '])break;'
				+ '${N}h[' + strvhash + ']=1;${X}}}',
			'>': has.byChildren ? 
				'var ${N}a=${R}.children;' + strvloop :
				'var ${N}a=${R}.childNodes;' + strvloop,
			'>T': 'var ${N}a=${R}.children.tags("${P}");' + strvloop,
			':root': strvdoc + 'var ${N}a=[doc.documentElement];' + strvloop,
			':link': strvlinks,
			':visited': strvlinks,
			':checked': 'var ${N}a=${R}.getElementsByTagName("input");' + strvloop,
			':enabled': strvform + 'if(${N}.disabled===false){${X}}}',
			':disabled': strvform + 'if(${N}.disabled===true){${X}}}'
		}});

		// Check ancestor/sibling
		mixin(vars, {rel: {
			'>': 'if(${N}.parentNode===root){${X}}',
			'+': num ?
				'if(${N}.previousElementSibling===root){${X}}' :
				'var ${N}=${C};while(${N}=${N}.previousSibling){'
				+ 'if(${N}.nodeType===1){break}}if(${N}===root){${X}}',
			'~': num ?
				'if(root.compareDocumentPosition(${N})&4){${X}}' :
				'if((root!=${N}&&root.contains(${N})&&16 )+'
				+ '(root!=${N}&&${N}.contains(root)&&8)+(root.nodeType===1?'
				+ '(root.sourceIndex<${N}.sourceIndex&&4)+('
				+ 'root.sourceIndex>${N}.sourceIndex&&2):1)&4){${X}}'
		}});

		// Condition filters
		var strvattr = '(t=${A})&&t.indexOf("${1}")',
			strvcache = '/*^var rev=query.verocache;^*/';

		mixin(vars, {filter: {
			'T': '/*^var ${N}t=xml?"${0}":("${0}").toUpperCase();^*/'
				+ '${N}.nodeName===${N}t',
			'#': '${N}.getAttribute("id")==="${0}"',
			'N': '${N}.getAttribute("name")==="${0}"',
			'[': has.hasAttribute ?
				'${N}.hasAttribute("${0}")' :
				'(t=${N}.getAttributeNode("${0}"))&&(t.specified)',
			'=': '${A}==="${1}"',
			'!=': '${A}!=="${1}"',
			'^=': strvattr + '===0',
			'$=': strvattr + '===(t.length - "${1}".length)',
			'*=': strvattr + '!==-1',
			'|=': '(t=${A})&&t.indexOf("-${1}-")!==-1',
			'~=': '(t=${A})&&(" "+t+" ").indexOf("${1}")!==-1',
			'*': '',

			':nth-child': strvcache + 'query.nth(${N},${1},${2},rev)',
			':nth-last-child': strvcache + 'query.nth(${N},${1},${2},rev,true)',
			':nth-of-type': strvcache + 'query.nthtype(${N},${1},${2},rev)',
			':nth-last-of-type': strvcache + 'query.nthtype(${N},${1},${2},rev,true)',
			':first-child': num ? '!${N}.previousElementSibling' : 'query.first(${N})',
			':last-child': num ? '!${N}.nextElementSibling' : 'query.last(${N})',
			':first-of-type': 'query.firsttype(${N})',
			':last-of-type': 'query.lasttype(${N})',
			':only-child': num ?
				'(t=${N}.parentNode)&&(t.firstElementChild===t.lastElementChild)' :
				'query.only(${N})',
			':only-of-type': 'query.onlytype(${N})',
	
			':root': '${N}===doc.documentElement',
			':empty': '!${N}.firstChild',
			':lang': '${N}.lang==="${0}"',

			// FIXME: investigation :visited
			':link': vars.vlink + '${N}.nodeName===tag_a',
			':visited': 'false',
			':hover': strvdoc + '${N}===doc.hoverElement',

			':active': strvdoc + '${N}===doc.activeElement',
			':focus': strvdoc + '${N}===doc.activeElement&&(!doc.hasFocus||'
				+ 'doc.hasFocus())&&!!(${N}.type||${N}.href)',
			':target': strvdoc + '${N}.id&&doc.location.hash.slice(1)===${N}.id',

			':enabled': '${N}.disabled===false',
			':disabled': '${N}.disabled===true',
			':checked': '${N}.checked===true',

			// Does not match a real document element
			'::first-line': 'false',
			'::first-letter': 'false',
			'::before': 'false',
			'::after': 'false',
			// Dynamically generate in filter
			':not': '',

			// Extended pseudos selectors
			':element': '${N}.nodeType===1',
			// For support selector ':contains(text)'
			':contains': (has.textContent ? '${N}.textContent' :
				(x ? 'query.getText(${N})' : '${N}.innerText')) + '.indexOf("${0}")>-1',
			// FIXME: not works as expected
			':not-ex': '/*^var _${G}=query.cacheMatch(query("${1}",root));'
				+ 'done=query.veroset;^*/!_${G}[' + strvhash + ']',
			':has': '(t=query("${1}", ${N}),done=query.veroset,t.length>0)'
		}});

		// Priority of seed selector
		mixin(vars, {finders: {
			':root': 10, '+': 10,
			'#': has.byId ? rfinders['#'] : 0,
			'>T': has.byChildTag ? rfinders['>T'] : 0,
			'N': has.byName ? rfinders['N'] : 0,
			'.': has.byClass ? rfinders['.'] : 0,
			'>': 6, '~': 6, 'T': 5,
			':checked': 4, ':enabled': 4, ':disabled': 4,
			':link': 3, ':visited': 3,
			'*': 0
		}});

		// Generate query function
		var strprev = num ? 'previousElementSibling' : 'previousSibling',
			strnext = num ? 'nextElementSibling' : 'nextSibling',
			strfirst = num ? 'firstElementChild' : 'firstChild',
			strelem =  num ? 'node.nodeName===name' :
				'node.nodeType===1&&node.nodeName===name',
			strmarges = 'while ( node = node.${0} ) {'
				+ 'if ( node.nodeType === 1 ) {return false;}'
				+ '}return true;',
			strchild = 'var name = node.nodeName;'
				+ 'while ( node=node.${0} ) {'
				+ 'if ( ' + strelem + ' ) {return false;}'
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

		// query api
		query = function( expr, context, seed ) {
			var sequnce = compilers[ x ].compile( expr ),
				sortOrder = has.sortOrder,
				i = sequnce.length,
				results = [];

			if ( i === 1 ) {
				results = sequnce[0]( context, !!x );
			} else {
				while ( i-- ) {
					//results = results.concat( sequnce[i](context) );
					push_native.apply( results, sequnce[i](context) );
				}

				//results = uniqueSort( results, sortOrder );
			}

			query.verocache += 1;
			return seed ? query.matchHas( seed, results ) : results;
		};

		mixin(query, {
			veroset: 1,
			verocache: 1,
			cacheMatch: function ( array ) {
				var sets = array.verohash;

				if ( !sets ) {
					var len = array.length,
						done = query.veroset;

					sets = array.verohash = {};
					while ( len-- ) {
						var it = array[len];
						sets[ it.veroset || (it.veroset = ++done) ] = 1;
					}
					query.veroset = done;
				}
				return sets;
			},
			matchHas: function( accepter, sender ) {
				var sets = query.cacheMatch( sender ),
			    	rs = [], i = 0, elem;

				for ( ; i < accepter.length; i++ ) {
					elem = accepter[i];
					if ( sets[elem.veroset || (elem.veroset = ++query.veroset)] ) {
						rs.push( elem );
					}
				}

				return rs;
			},
			// :nth-child(xxxx) :ntn-last-child(xxx)
			nth: newFun('node, a, b, cache, end', strsibling, [
				'', num ? 't.veroindex = ++count;' :
					'if ( t.nodeType === 1 ) {t.veroindex = ++count;}'
				]),
			// :nth-of-type(xxx) :nth-last-of-type(xxx)
			nthtype: newFun('node, a, b, cache, end', strsibling, [
				'var name = node.nodeName;',
				'if ( t.nodeName === name ) {t.veroindex = ++count;}'
				]),
			// :first-child
			first: newFun( 'node', strmarges, [strprev] ),
			// :last-child
			last: newFun( 'node', strmarges, [strnext] ),
			// :only-child
			only: function( node ) {
				return query.last( node ) && query.first( node );
			},
			// :first-of-type
			firsttype: newFun( 'node', strchild, [strprev] ),
			// :last-of-type
			lasttype: newFun( 'node', strchild, [strnext] ),
			// :only-of-type
			onlytype: function ( node ) {
				return query.lasttype( node ) && query.firsttype( node );
			}
		});

		if ( has.byId ) {
			query.byId = function( id, elem, doc ) {
				var m = doc.getElementById( id );
				return m && m.parentNode ? m : null;
			};
			if ( has.buggyById ) {
				query.byId = function( id, elem, doc ) {
					var m = doc.getElementById( id );

					return m && m.parentNode ?
						( elem.nodeType === 1 && contains(elem, m) ) && m.id === id ||
						typeof m.getAttributeNode !== strundefined &&
						m.getAttributeNode('id').value === id ?
							m :
							null :
						null;
				};
			}
		}
		// Support element.getElementById
		else if ( has.byTagID ) {
			query.byId = function( id, elem, doc ) {
				return elem.getElementsByTagName('*')[id];
			};
		}

		( envs[x] = vars, queries[x] = query, compilers[x] = new Compiler(x) );
	}

	( init( 0 ), init( 1 ) );

	return {
		query: function( expr, context, seed ) {
			context = context || document;
			return queries[ isXML(context, 1) ]( expr, context, seed );
		},
		compile: function( expr, context ) {
			context = context || document;
			return compilers[ isXML( context, 1 ) ].compile( expr );
		}
	};
}();

// === selector engine ===

function kquery( selector, context, seed ) {
	var match, elem, xdoc, has, m, nodeType, results = [];

	context = context || document;

	if ( !selector || typeof selector !== "string" ) {
		return [];
	}

	if ( (nodeType = context.nodeType) !== 1 && nodeType !== 9 ) {
		return [];
	}

	xdoc = isXML( context, 1 );
	has = queryHas( xdoc );

	if ( !xdoc && !seed ) {
		// Simple selector
		if ( (match = rquickExpr.exec( selector )) ) {
			// Speed-up: "#ID"
			if ( (m = match[1]) ) {
				if ( nodeType === 9 ) {
					elem = context.getElementById( m );
					// Check parentNode to catch when Blackberry 4.6 returns
					// nodes that are no longer in the document
					if ( elem && elem.parentNode ) {
						// Handle the case where IE, Opera, and Webkit return items
						// by name instead of ID
						if ( elem.id === m ) { return [ elem ]; }
					} else {
						return [];
					}
				} else {
					// Context is not a document
					if ( context.ownerDocument && (elem = context.ownerDocument.getElementById( m )) &&
						contains( context, elem ) && elem.id === m ) {
						return [ elem ];
					}
				}

			// Speed-up: "TAG"
			} else if ( match[2] ) {
				push.apply( results, context.getElementsByTagName( selector ) );
				return results;

			// Speed-up: ".CLASS"
			} else if ( (m = match[3]) && has.byClass && context.getElementsByClassName ) {
				push.apply( results, context.getElementsByClassName( m ) );
				return results;
			}
		}

		// QSA path
		if ( has.qsa && (!has.rqsaBugs || !has.rqsaBugs.test(selector)) ) {
			var oid = true,
				nid = 'verocache' + ( new Date().getTime() ),
				ncontext = context,
				nselector = nodeType === 9 && selector;

			// qSA works strangely on Element-rooted queries
			// We can work around this by specifying an extra ID on the root
			// and working up from there (Thanks to Andrew Dupont for the technique)
			// IE 8 doesn't work on object elements
			if ( nodeType === 1 && context.nodeName.toLowerCase() !== "object" ) {
				if ( (oid = context.getAttribute("id")) ) {
					nid = oid.replace( rescape, "\\$&" );
				} else {
					context.setAttribute( "id", nid );
				}

				nselector = selector.replace( rtrim, "" );
				nselector = nselector.replace( rgroups, "[id='" + nid + "'] $&" );
				ncontext = rsibling.test( selector ) && context.parentNode || context;
			}

			if ( nselector ) {
				// non-standard selector exit to use queryEngine.query
				try {
					push.apply( results, ncontext.querySelectorAll( nselector ) );
					return results;
				} catch( e ) {} finally {
					if ( !oid ) { context.removeAttribute( "id" ); }
				}
			}
		}
	}

	// All others
	return queryEngine.query( selector.replace( rtrim, "$1" ), context, seed );
}

kquery.matches = function( selector, elements ) {
	return kquery( selector, null, elements );
};

kquery.matchesSelector = function( elem, selector ) {
	var xdoc = isXML( elem, 1 ),
		has = queryHas( xdoc ),
		matches = has.matches;
	// Make sure that attribute selectors are quoted
	selector = selector.replace( rattributeQuotes, "='$1']" );

	// rbuggyQSA always contains :focus, so no need for an existence check
	if ( matches && !xdoc &&
		(!has.rmatchBugs || !has.rmatchBugs.test(selector)) &&
		!has.rqsaBugs.test(selector) ) {
		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			// As well, disconnected nodes are said to be in a document
			// fragment in IE 9
			if ( ret || has.disconnectedMatch ||
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch(e) {}
	}

	return queryEngine.query( selector, elem, [elem] ).length > 0;
};

kquery.isXML = function( node ) {
	return isXML( node );
};

kquery.contains = function( a, b ) {
	return queryHas( isXML(a, 1) ).contains( a, b );
};

kquery.error = function( msg ) {
	throw new Error( 'SyntaxError: ' + msg );
};

// Speed-up pseudos for :nth-xx-xx
if ( !queryHas(0).qsa ) {
	queryEngine.compile( 'div:nth-child(odd)' );
	queryEngine.compile( 'div:nth-last-child(odd)' );
	queryEngine.compile( 'div:nth-of-type(odd)' );
	queryEngine.compile( 'div:nth-last-of-type(odd)' );
}

// Expose API
window.kquery = kquery;

})( window );