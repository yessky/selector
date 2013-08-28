/*
 * KT - Light and Fast JavaScript Template Engine
 * Copyright (C) 2013 aaron.xiao
 * Author: aaron.xiao <admin@veryos.com>
 * Version: 1.0.0
 * Release: 2013/08/26
 * License: http://template.veryos.com/MIT-LICENSE
 */
(function( global ) {
	var KT = {};

	var settings = KT.settings = {
		openTag: '<%',
		closeTag: '%>'
	};

	var KEYWORDS = 'break|case|catch|continue|debugger|default|delete|do|else|false' +
		'|finally|for|function|if|in|instanceof|new|null|return|switch|this' +
		'|throw|true|try|typeof|var|void|while|with' +

		// reserved
		'|abstract|boolean|byte|char|class|const|double|enum|export|extends' +
		'|final|float|goto|implements|import|int|interface|long|native' +
		'|package|private|protected|public|short|static|super|synchronized' +
		'|throws|transient|volatile' +

		// ECMA 5 - use strict
		'|arguments|let|yield' +

		'|undefined';

	var rtrim = /^[\x20\t\n\r\f]*|[\x20\t\n\r\f]*$/;
	var rquoted = /'[^']*'|"[^"]*"/g;
	var rnoise = /\\\/|\\\/\*|\[.*?(\/|\\\/|\/\*)+.*?\]/g;
	var rtailreg = /\/[gim]*/g;
	var rregexp = /\/[^\/]*?\/[gim]*?/g;
	var rattribute = /[\x20\t\n\r\f]*\.[\x20\t\n\r\f]*[$\w\.]+/g;
	var rcomment = /\/\*(?:.|\n)*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$/g;
	var rspliter = /[^\w$]+/g;
	var rkeyword = new RegExp( '\\b' + KEYWORDS.replace(/\|/g, '\\b|\\b') + '\\b', 'g' );
	var rnumber = /\b\d[^,]*/g;
	var rtrimcomma = /^,+|,+$|(,)+/g;

	var letters = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';

	var ERROR_TYPES = {
		1: 'Template SyntaxError',
		2: 'Template RenderError'
	};

	function debug( source ) {
		var flag = true;
		try {
			new Function( 'data,lang,filters', source );
		} catch (e) {
			flag = false;
		}
		return flag;
	}

	function mixin( accepter, sender ) {
		var prop;
		for ( prop in sender ) {
			accepter[prop] = sender[prop];
		}
		return accepter;
	}

	function ErrorCtor( e ) {
		mixin(this, e);
	}

	ErrorCtor.prototype = {
		toString: function() {
			return this.name + '\n' +
				'>>> message: ' + this.message + '\n' +
				'>>> line: ' + this.line + '\n' +
				'>>> source: ' + this.source;
		}
	};

	function die( id, source, pos, message ) {
		var token = source.split( settings.openTag );
		throw new ErrorCtor({
			name: ERROR_TYPES[id],
			line : token.slice(0, pos - 1).join('').split(/\n/g).length - 1,
			source: token.slice(pos - 1).join('<%'),
			message: message
		});
	}

	function uid() {
		var sid = '', i = 8;
		while ( i-- ) {
			sid += letters.charAt( parseInt(Math.random() * 62) );
		}
		return '$_' + sid;
	}

	// extract variables to define them at the top
	function extract( source ) {
		// remove all string
		source = source.replace( rquoted, '' )
		// remove .xxx operations
		.replace( rattribute, '' )
		// remove regexp qualifier
		.replace( rtailreg, '/' )
		// remove noise regexp characters for remove comments
		.replace( rnoise, ' ' )
		// remove all comment safely
		.replace( rcomment, '' )
		// remove all regexp
		.replace( rregexp, '' )
		// split out variable
		.replace( rspliter, ',' )
		// avoding define keywords
		.replace( rkeyword, '' )
		// remove value assignment or invalid variable
		.replace( rnumber, '' )
		// remove redundant comma
		.replace( rtrimcomma, '$1' );
		return source ? source.split(',') : [];
	}

	var rassign = /=\s*([^:]+)(?::([a-zA-Z$_][\w$]*))?$/;
	var rinclude = /#include\s+('[\w$-]+'|"[\w$-]+")(\s*,\s*([a-zA-Z$_][\w$]*))?\s*$/;

	var compilerCache = {};

	var compiler = {
		dataRef: '',
		langRef: '',
		filterRef: '',
		outRef: '',
		posRef: '',
		refsMap: {},

		source: '',
		output: '',
		vars: {},
		pos: 0,

		init: function( source ) {
			var prefix = uid();
			this.refsMap[this.dataRef = prefix + '_D'] = 1;
			this.refsMap[this.langRef = prefix + '_L'] = 1;
			this.refsMap[this.filterRef = prefix + '_F'] = 1;
			this.refsMap[this.outRef = prefix + '_T'] = 1;
			this.refsMap[this.posRef = prefix + '_P'] = 1;

			this.source = source;
			this.output = '';
			this.vars = {};
			this.pos = 0;
		},

		parse: function( source ) {
			// loosely syntax for
			// <% = vale %>/<%= value%>/<%=value%> are ok
			var i = -1, value, name, names;

			source = source.replace( rtrim, '' );

			if ( source.indexOf('=') === 0 ) {
				if ( !(value = source.match( rassign )) ) {
					this.die( this.pos, 'invalid assignment or call filter incorrectly' );
				}

				name = value[2];
				value = value[1];

				if ( name ) {
					value = this.filterRef + '.' + name + '(' + value + ')';
				}

				source = this.outRef + '+=' + value + ';';
			} else if ( source.indexOf('#include') === 0 ) {
				if ( !(value = source.match( rinclude )) ) {
					this.die( this.pos, 'invalid arguments for include' );
				}

				name = value[1];
				value = value[3] || this.dataRef;
				value = this.langRef + '.include(' + [name, value].join(',') + ')';

				source = this.outRef + '+=' + value + ';';
			} else {
				// avoid potential syntax error
				source += '\n';
			}

			// extract variables
			names = extract( source );
			while ( (name = names[++i]) ) {
				if ( !(name in this.refsMap) ) {
					this.vars[ name ] = 1;
				}
			}

			return source;
		},

		compile: function( id ) {
			if ( compilerCache[id + ' '] ) {
				return compilerCache[id + ' '];
			}

			var source = templateCache[id + ' '],
				i = -1, body = '',
				closeTag, parts, part, text, logic;

			if ( !source ) {
				throw new Error('template "' + id + '" was not found' +
					'\n    template should be register before use it');
			}

			this.init( source );
			closeTag = settings.closeTag;
			parts = source.split( settings.openTag );

			while ( (part = parts[++i]) ) {
				part = part.split( closeTag );

				if ( part.length === 1 ) {
					text = part[0];
					logic = false;
				} else {
					text = part[1];
					logic = part[0];
				}

				if ( logic ) {
					this.pos = i;
					body += this.posRef + '=' + i + ';\n';
					body += this.parse( logic );
				}

				if ( text ) {
					body += this.outRef + '+="' + lang.stringify(text) + '";';
				}
			}

			text = 'var ' + this.dataRef + '=data,' + this.outRef + '="";';
			text += 'var ' + this.langRef + '=lang,' + this.posRef + '=0;';
			text += 'var ' + this.filterRef + '=filters;';
			text += 'data=lang=filters=undefined;';

			// define variables extract from data
			for ( i in this.vars ) {
				text += 'var ' + i + '=' + this.dataRef + '.' + i + ';';
			}

			// Standard compile output
			this.output = '"use strict";' + text + 'try{' + body +
				'}catch(ex){var e=new Error();e.message=ex.message;e.pos=' +
				this.posRef + ';throw e;}return ' + this.outRef + ';';
			// For debug and locate error line/position
			body = '"use strict";' + text + body + 'return ' + this.outRef + ';';

			try {
				return new Function( 'data,lang,filters', this.output );
			} catch (e) {
				var reg = new RegExp( '\\' + this.posRef + '=\\d+;\\n' ),
					token = body.split( reg ),
					pos = 1, count = token.length;

	    		while ( pos < count ) {
	    			if ( debug(token.slice(0, pos).join('')) ) {
	    				pos += 2;
	    			} else {
	    				break;
	    			}
	    		}

				this.die( pos - 1, e.message );
			}
		},

		die: function( pos, message ) {
			die( 1, this.source, pos, message );
		}
	};

	var helpers = {
		log: function( msg ) {
			global.console && global.console.log( msg );
		},
		alert: function( msg ) {
			global.alert && global.alert( msg );
		}
	};

	var lang = {
		stringify: function( value ) {
			return typeof value !== 'string' ? value :
				value.replace(/("|\\)/g, '\\$1' )
					.replace( /\r/g, '\\r' ).replace( /\n/g, '\\n' );
		},
		include: function( id, data ) {
			return KT.render( id, data );
		}
	};

	var filters = {
		escape: function( value ) {
			return typeof value === 'string' || value instanceof String ?
				value.replace( /&/g, '\x26amp;' )
				.replace( /</g, '\x26lt;' )
				.replace( />/g, '\x26gt;' )
				.replace( /"/g, '\x26quot;' )
				.replace( /'/g, '\x26#39;' ) : value;
		}
	};

	KT.registerFilter = function( filterName, handler ) {
		if ( filterName in filters  ) {
			return console.warn( 'filter ' + filterName + ' was already registered' );
		}
		filters[filterName] = function( value ) {
			return handler.call( filters, value );
		};
	};

	var templateCache = {};

	KT.registerTemplate = function( id, templateString ) {
		if ( (id + ' ') in templateCache ) {
			throw new ReferenceError('template "' + id + '" already exist');
		}
		return (templateCache[ id + ' ' ] = templateString);
	};

	KT.render = function( id, data ) {
		if ( typeof id !== 'string' && !(id instanceof String) ) {
			throw new TypeError( 'Render requires template id' );
		}

		var render = compiler.compile(id),
			self = mixin({}, helpers);

		try {
			return render.call( self, data, lang, filters );
		} catch (e) {
			die( 2, templateCache[id + ' '], e.pos + 1, e.message );
		}
	};

	// EXPOSE
	if ( typeof define === 'function' && define.amd ) {
		define(function() { return KT; });
	} else {
		window.KT = KT;
	}
}( this, undefined ));