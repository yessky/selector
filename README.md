KS - A Super Fast And Compatible CSS Selector Engine
======

KS is a pure-JavaScript css selector engine, selectors of css1/2/3 are supported.

## Getting Started

Download the [production version][min] or the [development version][max].

Speed Test At: <a href="http://test.veryos.com/selector/slickspeed/index.html" target="_blank">Slickspeed</a>.

Testsuite At: <a href="http://test.veryos.com/selector/testsuite.html" target="_blank">Testsuite</a>.

[min]: https://raw.github.com/yessky/selector/master/dist/ks.min.js
[max]: https://raw.github.com/yessky/selector/master/src/ks.js

In your web page:

```html
<script src="dist/ks.min.js"></script>
<script>
var a = KS('#id');
var b = KS('.class');
var c = KS('div div');
var d = KS('div:nth-child(even)');
</script>
```

##NOTE

in 2.0, api name changes to 'KS' and will not change it anymore.

from 2.x, using right-to-left matching instead of left-to-right matching, even l-2-r matching is faster than r-2-l matching in old browser.
as for some special selector(eg, * ~ * *), it's hard to compile with our optima strategies to get a l-2-r matching query.

another, XPath was bring in to handle XML Document query.

## Documentation
_(Coming soon)_

## Release History
_(Nothing yet)_

## Features
	compatibility - all major browsers ie6+/chrome/firefox/opera/safari.

	light - 16kb minified, only 5.0kB minified and gzipped.

	super fast - pre-compile selector to a query function.

	reliable - not cache result

	documents support - works on both XML/HTML.

## Contact

admin@veryos.com aaron.xiao

## Help

If you have any questions, feel free to <a href="https://github.com/yessky/selector/issues/new" target="_blank">create ticket</a> or <a href="mailto:admin@veryos.com" target="_blank">contact via email</a>.

weibo:  <a href="http://weibo.com/veryos" target="_blank">http://weibo.com/veryos</a>.

## License

KS is available under the terms of the <a href="https://github.com/yessky/selector/blob/master/LICENSE.md" target="_blank">MIT License</a>.
