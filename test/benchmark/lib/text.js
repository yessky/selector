define(function( require ) {
	var _createXHR = function() {
			return new XMLHttpRequest();
		},
		_contentHandlers = {
			
		};

	if ( typeof XMLHttpRequest === 'undefined' ) {
		var progids = [
				'Msxml2.XMLHTTP',
				'Microsoft.XMLHTTP',
				'Msxml2.XMLHTTP.4.0'
			],
			i = 0, progid;

		for ( ; i < 3; ) {
			try{
				progid = progids[i++];
				if ( new ActiveXObject(progid) ) {
					break;
				}
			} catch(e) {}
		}
		_createXHR = function() {
			return new ActiveXObject( progid );
		};
	}

	function request( args ) {
		var xhr = _createXHR();

		if ( !xhr ) {
			throw 'XMLHttpRequest is not supported';
		}

		xhr.open( args.method, args.url, !!args.sync );
		try {
            netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead")
        } catch(e) {}
		xhr.onreadystatechange = _ioWatch( xhr, args.complete );
		xhr.send();
		//xhr.send( args.data || null );
		xhr = null;
	}

	function _ioWatch( xhr, callback ) {
		return function() {
			if ( xhr.readyState === 4 ) {
				if ( !xhr.status || (!!xhr.status &&
					xhr.status >= 200 && xhr.status < 300) ) {
					callback( xhr.responseText );
				}
			}
		};
	}

	return {
		load: function( uri, callback ) {
			request({
				url: uri.id,
				method: 'get',
				complete: function( content ) {
					define( uri.id, [], content );
					callback( uri );
				}
			});
		}
	}
});