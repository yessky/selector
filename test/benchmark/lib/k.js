/**
 * @author aaron.xiao
 */

/**
 * implemention of vero's kernel
 * it includes 3 parts:
 * 1. an AMD loader implemention
 * 2. explict 'vero' namespace in global env & domready handler
 * 3. subscribe/publish an implmention of observe pattern
 */

(function( global ) {
	var document = global.document,
		location = global.location,

		_kjs = global.kjs,
		_K = global.K,

		toString = {}.toString,
		indexOf = [].indexOf,
		splice = [].splice,

		isFunction = function( it ) {
			return toString.call( it ) == "[object Function]";
		},

		isString = function( it ) {
			return toString.call( it ) == "[object String]";
		},

		isArray = function( it ) {
			return toString.call( it ) == "[object Array]";
		},

		mixin = function( target, source ) {
			for ( var prop in source ) {
				target[prop] = source[prop];
			}
			return target;
		},

		kjs = {
			version: 'dev 1.0'
		},

		K = kjs,

		hub;

	// subscrible/publish/unsubscribe

	hub = (function() {
		var identifier = 1,
			channels = {},
			counter = {};

		return {
			subscribe: function( name, listener ) {
				if ( !isString(name) || !isFunction(listener) ) {
					return;
				}

				var done = channels[name];

				if ( !done ) {
					done = channels[name] = {};
					counter[name] = 0;
				}

				done[identifier] = listener;
				counter[name] += 1;

				return [ name, identifier++ ];
			},

			publish: function( name ) {
				var done, args, index;

				if ( !name || !isString(name) ) {
					return;
				}

				done = channels[name];
				args = [].slice.call( arguments, 1 );

				for ( index in done ) {
					done[index].apply( this, args );
				}
			},

			unsubscribe: function unsubscribe( handle ) {
				var isa = isArray( handle ),
					name = isa ? handle[0] : handle,
					done;

				if ( !name || !isString(name) ) {
					return;
				}

				done = channels[name];

				if ( isa ) {
					counter[name] -= 1;
					delete done[handle[1]];
				}

				if ( !isa || counter[name] === 0 ) {
					delete channels[name];
					delete counter[name];
				}
			}
		};
	})();

	mixin( K, hub );

	// DOM ready stuffs

	var isStraped = false,
		isDOMReady = false,
		readyHandlers = [],
		DOMContentLoaded;

	if ( document.addEventListener ) {
		DOMContentLoaded = function() {
			document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );
			doneDOMReady();
		};
	} else if ( document.attachEvent ) {
		DOMContentLoaded = function() {
			if ( document.readyState === "complete" ) {
				document.detachEvent( "onreadystatechange", DOMContentLoaded );
				doneDOMReady();
			}
		};
	}

	K.ready = function( handler ) {
		if ( isDOMReady ) {
			handler();
		} else {
			readyHandlers.push( handler );
		}
	};

	hookDOMReady();

	function doneDOMReady() {
		if ( !isDOMReady ) {
			if ( !document.body ) {
				return setTimeout( doneDOMReady, 1 );
			}

			isDOMReady = true;

			if ( readyHandlers && readyHandlers.length ) {
				var handler;

				while ( readyHandlers.length ) {
					handler = readyHandlers.shift();

					if ( typeof handler == 'function' ) {
						handler();
					}
				}

				readyHandlers = null;
			}
		}
	}

	function doScrollCheck() {
		if ( isDOMReady ) {
			return;
		}

		try {
			document.documentElement.doScroll( "left" );
		} catch( e ) {
			setTimeout( doScrollCheck, 1 );
			return;
		}

		doneDOMReady();
	}

	function hookDOMReady() {
		if ( document.readyState === "complete" ) {
			return setTimeout( doneDOMReady, 1 );
		}

		if ( document.addEventListener ) {
			document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );
			global.addEventListener( "load", doneDOMReady, false );
		} else if ( document.attachEvent ) {
			var isFrame = false;

			document.attachEvent( "onreadystatechange", DOMContentLoaded );
			global.attachEvent( "onload", doneDOMReady );

			try {
				isFrame = global.frameElement == null;
			} catch(e) {}

			if ( document.documentElement.doScroll && isFrame ) {
				doScrollCheck();
			}
		}
	}

	// AMD loader stuffs

	var rext = /\.(?:[a-z][a-z0-9]*)$/i,
		rslash = /([^:\/])\/\/+/g,
		rcomment = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
		ruri = /^([^!]+)!([^!]+?)$/,
		rdeps = /[^.]\brequire\(\s*["']([^'")]+)["']\s*\)/g,

		strundefined = 'undefined',
		isOpera = typeof(opera) !== strundefined &&
			opera.toString() === "[object Opera]",
		baseElement = document.getElementsByTagName('base')[0],
		head = document.head ||
			document.getElementsByTagName('head')[0] ||
			document.documentElement,

		interactived = false,
		currentlyAddingScript,
		interactiveScript,

		hashURI = {},
		hashAlias = {},
		dataUris = {},
		contexts = {},
		globalContext = [],
		declared = {},

		console = global.console,
		config = {},
		isContextWait = true,
		waitList = [],

		nowHost,
		nowDir,
		isLocal,
		scriptDir,
		dataMain;

	// Status code of module
	var START = 0,
		LOADING = 1,
		LOADED = 2,
		FETCHED = 3,
		READY = 4,
		DECLARED = 5,
		ERROR = 6,
		TIMEOUT = 7;

	// Helpers
	var util = {
		notify: function ( o ) {
			if ( o.type === 'error' ) {
				throw o.message;
			} else if ( console && console.log ) {
				var exec = console[ o.type ] || console.log;
				exec.call( console, o.message );
			}
		},

		indexOf: function( vet, item ) {
			return indexOf.call( vet, item );
		}
	};

	if ( !util.indexOf ) {
		util.indexOf = function( vet, des ) {
			var i = 0,
				len = vet.length;
	
			for ( ; i < len; i++ ) {
				if ( vet[i] === des ) {
					return i;
				}
			}
	
			return -1;
		};
	}

	// Public define api
	function define( name, deps, factory ) {
		if ( !isString(name) ) {
			factory = deps;
			deps = name;
			name = undefined;
		}

		if ( !isArray(deps) ) {
			factory = deps;
			deps = [];
		}

		if ( typeof factory === strundefined ) {
			util.notify({
				type: 'error',
				message: 'Invalid module defination'
			});
		}

		var script, ctx, defs;

		if ( isFunction(factory) ) {
			if ( factory.length ) {
                factory.toString().replace(rcomment, "").replace(rdeps, function (a, b) {
                	deps.push( b );
				});
			}
		}

		deps = util.unique( deps );

		if ( interactived ) {
			script = currentlyAddingScript || util.getInteractiveScript();
			if ( script ) {
				ctx = util.toUri( util.getScriptAbsPath( script ) );
			}
		}

		if ( ctx ) {
			name = ( !name || name === ctx ) ? ctx : util.toUri( name, ctx );
			defs = contexts[ctx] || ( contexts[ctx] = [] );
			defs.push({
				id: name,
				deps: deps,
				factory: factory
			});
		} else {
			if ( name && util.isInline(name) ) {
				name = util.toUri( name );
				if ( dataUris[name] && dataUris[name].status !== DECLARED ) {
					util.notify({
						type: 'warn',
						message: 'Couldn\'t override registered module ' + name
					});
				} else {
					dataUris[name] = {
						id: name,
						deps: deps,
						factory: factory,
						type: 'js',
						loader: false,
						status: FETCHED
					};
				}
			} else {
				globalContext.push({
					id: name,
					deps: deps,
					factory: factory
				});
			}
		}

		return undefined;
	}

	// Public require api
	function require( uris, callback ) {
		uris = !isArray( uris ) ? [String(uris)] : uris;

		if ( isContextWait ) {
			waitList.push({
				uris: uris,
				callback: callback
			});

			return undefined;
		}

		uris = util.parseUri( util.toUri(uris), 1 );

		var main = uris.slice( 0, 1 ),
			pkgs = uris.slice( 1 ),
			handle = function() {
				var args = [],
					i = 0,
					len = uris.length,
					mod;

				for ( ; i < len; i++ ) {
					mod = declared[ uris[i].id ];
					args.push( mod.exports );
				}

				if ( callback ) {
					callback.apply( global, args );
				}
			};

		util.fetch(main, function() {
			if ( pkgs.length === 0 ) {
				handle();
			} else {
				util.fetch( pkgs, handle );
			}
		});

		return undefined;
	}

	// Module constructor
	function Module( meta ) {
		mixin( this, meta );
		this.dependencies = this.dependencies || [];
	}

	// Helpers for handling path
	mixin(util, {
		getHost: function( url ) {
			return url.replace( /^(\w+:\/\/[^/]*)\/?.*$/, '$1' );
		},

		getDir: function( url ) {
			var m = url.match( /.*(?=\/.*$)/ );
	   		return ( m ? m[0] : '.' ) + '/';
		},

		isXDomain: function( url ) {
			if ( url.indexOf( '://' ) > 0 ) {
				return false;
			}

			if ( util.getHost( url ) !== nowHost ) {
				return true;
			}

			return false;
		},

		toAbs: function( path ) {
			rslash.lastIndex = 0;

			if ( rslash.test(path) ) {
				path = path.replace( rslash, '$1\/' );
			}

			if ( path.indexOf( '.' ) === -1 ) {
				return path;
			}

			var parts = path.split( '/' ),
				ret = [],
				part;

			while ( parts.length ) {
				part = parts.shift();
				if ( part == ".." ) {
					if ( ret.length === 0 ) {
						util.notify({
							type: 'error',
							message: 'Invalid path: ' + path
						});
					}
					ret.pop();
				} else if ( part !== '.' ) {
					ret.push( part );
				}
			}

			return ret.join( '/' );
		},

		normalize: function( path ) {
			path = util.toAbs( path );

			if ( /#$/.test( path ) ) {
				path = path.slice( 0, -1 );
			} else if ( path.indexOf( '?' ) === -1 && !rext.test( path ) ) {
				path = path + '.js';
			}

			if ( !isLocal && !util.isXDomain( path ) && path.indexOf('://') > 0 ) {
				path = path.replace( nowHost, '' );
			}

			return path;
		},

		unique: function( deps ) {
			var i = 0,
				len = deps.length,
				hash = {},
				ret = [],
				meta;

			for ( ; i < len ; i++ ) {
				meta = util.parseUri( deps[i] );

				if ( !hash[meta.id] ) {
					ret.push( deps[i] );
					hash[ meta.id ] = 1;
				}
			}

			return ret;
		},

		toUri: function( path, rel ) {
			if ( isArray(path) ) {
				var ret = [],
					i = 0,
					len = path.length;

				for ( ; i < len; i++ ) {
					ret.push( util.toUri(path[i], rel) );
				}

				return ret;
			}

			var src, hash;

			if ( hashAlias[path] ) {
				path = hashAlias[path];
			}

			// Skip absolute path and inline path
			if ( path.indexOf('://') > 0 ||
				path.indexOf('//') === 0 ||
				path.indexOf('/') === 0 ||
				util.isInline(path) ) {
				src = path;
			} else {
				if ( path.indexOf('./') === 0 ) {
					path = path.substring( 2 );
				}
				src = util.getDir(rel || nowDir) + path;
			}

			if ( (hash = hashURI[src]) ) {
				return hash;
			}

			return ( hash = hashURI[src] = util.normalize(src), hash );
		},

		parseUri: function( path, ig ) {
			if ( isArray(path) ) {
				var ret = [],
					i = 0,
					len = path.length;

				for ( ; i < len; i++ ) {
					ret.push( util.parseUri(path[i], ig) );
				}

				return ret;
			}

			var lp = false,
				match;

			if ( !ig && (match = path.match(ruri)) ) {
				lp = match[1];
				path = match[2];
			}

			return {
				id: path,
				loader: !ig ? lp : false
			};
		},

		isInline: function( uri ) {
			return uri.indexOf( '~/' ) === 0;
		},

		getScriptAbsPath: function( node ) {
			return node.hasAttribute ? node.src : node.getAttribute( 'src', 4 );
		},

		getInteractiveScript: function() {
			if ( interactiveScript && interactiveScript.readyState === 'interactive' ) {
				return interactiveScript;
			}

			var scripts = head.getElementsByTagName( 'script' ),
				i = 0,
				len = scripts.length,
				script;

			for ( i = 0; i < len; i++ ) {
				script = scripts[ i ];
				if ( script.readyState === 'interactive' ) {
					interactiveScript = script;
					return script;
				}
			}
		}
	});

	nowHost = util.getHost( location.href );
	nowDir = util.getDir( location.href );
	isLocal = location.protocol === 'file:';

	mixin(util, {
		fetch: function( urisArray, callback ) {
			var i = 0,
				len = urisArray.length,
				uris = [],
				topics = [],
				uri, cb, meta, count;

			for ( ; i < len; i++ ) {
				uri = urisArray[i];
				!declared[uri.id] && uris.push( uri );
			}

			count = uris.length;

			if ( count === 0 ) {
				return callback() && undefined;
			}

			cb = util.callback( count, topics, callback );

			while ( (uri = uris.shift()) ) {
				topics.push( K.subscribe(uri.id, cb) );

				if ( !declared[uri.id] ) {
					meta = dataUris[uri.id];

					if ( meta ) {
						util.lookup( uri );
						// TODO: move follwoing stuff to util.lookup.
						/*if ( inline ) {
							util.state( uri );
						} else {
							// Check if we can reload mofule if ti is error
							// Other status just waiting for the publish event.
							if ( meta.status === ERROR ) {
								// Module is a loader
								loader = meta.loader && dataUris[meta.loader];
	
								if ( meta.specified && meta.tried >= 3  ) {
									K.publish( id, true );
								} else if ( loader && loader.tried < 3 ) {
									util.load( uri );
								}
							}
						}*/
					} else {
						if ( util.isInline(uri.id) ) {
							util.notify({
								type: 'error',
								message: 'Couldn\'t find inline module ' + uri.id
							});
						} else {
							util.load( uri );
						}
					}
				} else {
					K.publish( uri.id );
				}
			}
		},

		callback: function( count, topics, process ) {
			return function() {
				if ( --count <= 0 ) {
					while ( topics.length ) {
						K.unsubscribe( topics.shift() );
					}
					process();
				}
			};
		},

		require: function( ctx ) {
			var inline = util.isInline( ctx.id ),
				rel = inline ? nowDir : ctx.id,
				req = function( id ) {
					var uri = util.parseUri( id ),
						mod = declared[ util.toUri(uri.id, rel) ];
					return mod && mod.exports || undefined;
				};

			req.toUrl = function( id ) {
				return require.toUrl( id, rel );
			};

			return req;
		},

		load: function( uri ) {
			var id = uri.id,
				loader = uri.loader,
				specified = uri.specified,
				meta = dataUris[id],
				loaderMod;

			if ( !meta ) {
				meta = dataUris[id] = {
					id: id,
					loader: loader,
					specified: specified,
					status: START,
					tried: 0
				};
			}

			meta.tried = meta.tried + 1;
			if ( loader ) {
				loader = util.toUri( loader, scriptDir );
				loaderMod = declared[loader];

				if ( !loaderMod ) {
					// Notifying moudle which depend on the loader
					var topic = K.subscribe(loader, function( error ) {
							K.unsubscribe( topic );
							if ( error ) {
								util.notify({
									type: 'error',
									message: 'Couldn\'t load ' + id + ', As failed to load  loader ' + loader
								})
							}
						});

					util.fetch([{
						id: loader,
						loader: false,
						specified: 1
					}], function() {
						loaderMod = declared[loader];
						if ( loaderMod ) {
							meta.status = LOADING;
							loaderMod.exports.load( uri, util.save );
						}
					});
				} else {
					meta.status = LOADING;
					loader.exports.load( uri, util.save );
				}
			} else {
				util._load( id );
			}
		},

		_load: function( src ) {
			var node = document.createElement( 'script' ),
				ate = node.attachEvent;

			node.type = "text/javascript";
			node.charset = "utf-8";
			node.async = true;

			if ( ate && !(ate.toString &&
				ate.toString().indexOf('[native code]') < 0 ) && !isOpera ) {
				interactived = true;
				node.attachEvent( "onreadystatechange", util.onLoad );
			} else {
				node.addEventListener( "load", util.onLoad, false );
				node.addEventListener( "error", util.onLoad, false );
			}

			node.src = src;
			currentlyAddingScript = node;

			if ( baseElement ) {
				head.insertBefore( node, baseElement );
			} else {
				head.appendChild( node );
			}

			currentlyAddingScript = null;

			return node;
		},

		// If script load successfully or failed,
		// inlne module('~/mod') nerver enter here.
		save: function( uri ) {
			var id = uri.id,
				queue = util.getContextMeta( id ),
				stack = queue.slice( 0 ),
				meta = dataUris[id],
				found,
				ctx;

			// Mark as loaded
			meta.status = LOADED;

			// Call define queue
			while ( queue.length ) {
				ctx = queue.shift();

				if ( !ctx.id ) {
					ctx.id = id;
					if ( found ) {
						break;
					}
					found = true;
				} else if ( ctx.id === id ) {
					found = true;
				}

				util._save( ctx );
			}

			if ( !found && !declared[id] && meta.status !== ERROR ) {
				if ( config.definition === 'force' ) {
					util._save( [id, [], config.shim || {}] );
				} else {
					meta.status = ERROR;
					util.notify({
						type: 'error',
						message: 'No define call for \'' + id + '\''
					});
				}
			}

			while ( stack.length ) {
				util.lookup( stack.shift() );
			}
		},

		_save: function( ctx ) {
			var id = ctx.id,
				deps =  ctx.deps ? util.toUri( ctx.deps, id ) : [],
				factory = ctx.factory,
				meta = dataUris[id];

			// Moudle has a correspondent script
			if ( meta ) {
				if ( meta.status === FETCHED || meta.status === DECLARED ) {
					util.notify({
						type: 'warn',
						message: 'Couldn\'t override registered module ' + id
					});
				} else {
					if ( typeof factory === strundefined ) {
						util.notify({
							type: 'error',
							message: 'Couldn\'t load  module ' + id
						});
					}

					mixin(meta, {
						deps: deps,
						factory: factory,
						status: FETCHED
					});
					// FIXME: reload faild module ?
				}
			} else {
				dataUris[id] = {
					id: id,
					deps: deps,
					factory: factory,
					type: 'js',
					loader: false,
					status: FETCHED,
					tried: 1
				};
			}
		},

		lookup: function( uri ) {
			var id = uri.id,
				meta = dataUris[id],
				deps = meta.deps,
				pendUris = [],
				pendDeps;

			if ( meta.status < FETCHED ) {
				return undefined;
			}

			if ( meta.status === DECLARED ) {
				return K.publish( id );
			}

			// FIXME: Whether need to deal other status here ?

			if ( deps && deps.length ) {
				pendDeps = util.resolveCyclicDependencies( meta );

				if ( deps.length !== pendDeps.length ) {
					util.notify({
						type: 'warn',
						message: 'Found cyclic denpendencies in ' + id
					});
				}
			}

			if ( pendDeps && pendDeps.length > 0 ) {
				var realDeps = [],
					rel = util.isInline( id ) ? null : id,
					i = 0,
					len = pendDeps.length,
					it;

				for ( ; i < len; i++ ) {
					it = util.parseUri( pendDeps[i] );
					it.id = util.toUri( it.id, rel );
					realDeps.push( it );
					pendUris.push( it.id );
				}

				pendDeps = realDeps;
			}

			if ( pendUris.length === 0 || util.isModulesReady(pendUris) ) {
				meta.status = READY;
				util.declare( uri );
			} else {
				util.fetch(pendDeps, function() {
					meta.status = util.isModulesReady( pendUris ) ? READY : ERROR;
					util.declare( uri );
				});
			}
		},

		// FIXME: resolve duplicate declare when load page at first time
		// 1. code problem
		// 2. proxy server
		declare: function( uri ) {
			var id = uri.id,
				meta = dataUris[id],
				module = declared[id];

			if ( meta.status === ERROR ) {
				return K.publish( id, true );
			}

			if ( module || meta.status < READY || meta.status === DECLARED ) {
				return;
			}

			//debugger;
			module = declared[id] = new Module({
				id: id,
				dependencies: meta.deps,
				exports: {}
			});
			meta.status = DECLARED;

			var factory = meta.factory,
				require = util.require( module ),
				exports = module.exports,
				ret;

			if ( isFunction( factory ) ) {
				ret = factory.call( global, require, exports, module );
				if ( typeof(ret) !== strundefined ) {
					module.exports = ret;
				}
			} else {
				module.exports = factory || {};
			}

			K.publish( id );
		},

		onLoad: function( e ) {
			var node = e.currentTarget || e.srcElement,
				uri;

			if ( e.type === "load" || e.type === "error" ||
				(node && /^(complete|loaded)$/.test(node.readyState)) ) {
				interactiveScript = null;
				uri = util.toUri( util.getScriptAbsPath(node) );
				util.save( {id: uri} );

				if ( node.detachEvent && !isOpera ) {
					node.detachEvent( "onreadystatechange", util.onLoad );
				} else {
					node.removeEventListener( "load", util.onLoad, false );
					node.removeEventListener( "error", util.onLoad, false );
				}

				node.parentNode.removeChild( node );
			}
		},

		getContextMeta: function( id ) {
			var queue = contexts[id] || [],
				ctx;

			while ( globalContext.length ) {
				ctx = globalContext.shift();
				ctx.id = ctx.id ? util.toUri( ctx.id, id ) : ctx.id;
				queue.push( ctx );
			}

			return ( globalContext = [], queue );
		},

		isModulesReady: function( uris ) {
			var i = 0,
				len = uris.length;

			for ( ; i < len; i++ ) {
				if ( !declared[uris[i]] ) {
					return false;
				}
			}

			return true;
		},

		hasCyclicDependencies: function( meta, id ) {
			if ( !meta || declared[meta.id] || meta.status === DECLARED ) {
				return false;
			}

			var deps = meta.deps,
				i = 0,
				len = deps ? deps.length : 0;

			if ( len ) {
				if ( util.indexOf(deps, id) !== -1 ) {
					return true;
				} else {
					for ( ; i < len; i++ ) {
						if ( util.hasCyclicDependencies(dataUris[deps[i]], id) ) {
							return true;
						}
					}

					return false;
				}
			}

			return false;
		},

		resolveCyclicDependencies: function( meta ) {
			var ret = [],
				id = meta.id,
				deps = meta.deps,
				i = 0,
				len = deps.length;

			for ( ; i < len; i++ ) {
				if ( !util.hasCyclicDependencies(dataUris[deps[i]], id) ) {
					ret.push( deps[i] );
				}
			}

			return ret;
		}
	});

	define.amd = {
		vendor: 'kjs'
	};

	require.toUrl = function( uri, rel ) {
		return util.toUri( uri, rel );
	};

	// FIXME: handle duplicate/conflict alias
	require.config = function( params ) {
		var prop, ctx;

		for ( prop in params ) {
			if ( !(prop in empty) ) {
				switch ( prop ) {
					case 'alias':
						for ( ctx in params[prop] ) {
							if ( !(ctx in params[prop]) ) {
								hashAlias[ctx] = params[prop][ctx];
							}
						}
						break;
				}
			}
		}
	};

	if ( global.define ) {
		if ( global.define.amd && global.define.amd === 'kjs' ) {
			return;
		}
	} else {
		global.define = define;
		global.require = require;
	}

	// Handle data-main
	var kjsnode = document.getElementById( 'kjsnode' ),
		scripts, dr;

	if ( !kjsnode ) {
		scripts = document.getElementsByTagName( 'script' );
    	kjsnode = scripts[ scripts.length - 1 ];
	}

	scriptDir = util.getDir( util.getScriptAbsPath(kjsnode) );
	dataMain = kjsnode.getAttribute( 'data-main' ) || '';

	if ( dataMain ) {
		dataMain = dataMain.split( /\s*,\s*/ );
		require( dataMain );
	}

	setTimeout(function() {
		isContextWait = false;
		while ( waitList.length ) {
			dr = waitList.shift();
			require( dr.uris, dr.callback );
		}
	}, 0);

	K.use = function( uri, callback ) {
		require( uri, callback );
	};

	// Resolve conflict of namespace
	K.resolve = function( deep ) {
		if ( global.K === kjs ) {
			global.K = _K;
		}

		if ( deep && global.kjs === kjs ) {
			global.kjs = _kjs;
		}

		return kjs;
	};

	// Expose
	global.kjs = global.K = kjs;
})( this, undefined );