A Super Fast And Compatible CSS Selector Engine
======

A Super Fast And Compatible CSS Selector Engine with selectors of css1/2/3 supported.

## Getting Started

Download the [production version][min] or the [development version][max].

Speed Test At: <a href="http://test.veryos.com/selector/slickspeed/index.html" target="_blank">Slickspeed</a>.

Testsuite At: <a href="http://test.veryos.com/selector/testsuite.html" target="_blank">Testsuite</a>.

[min]: https://raw.github.com/yessky/selector/master/dist/query.min.js
[max]: https://raw.github.com/yessky/selector/master/src/query.js

In your web page:

```html
<script src="dist/query.min.js"></script>
<script>
	var a = query('#id');
	var b = query('.class');
	var c = query('div div');
	var d = query('div:nth-child(even)');
</script>
```

OR in your javascript module:

```html
require(['path/to/query'], function(require) {
	var query = require('path/to/query');
	var a = query('#id');
	var b = query('.class');
	var c = query('div div');
	var d = query('div:nth-child(even)');
});
```

##NOTE

All codes was refactoring. complier will choose the fastest matching types(left-to-rigth or right-to-left or both) depends on selector.

another, XPath was bring in to handle XML Document query under IE < 9(or with the same kernel/feature).

## Documentation
_(Coming soon)_

## Release History
_(Nothing yet)_

## Features
	compatibility - all major browsers ie6+/chrome/firefox/opera/safari.

	light - 20kb minified, only 8.9kB minified and gzipped.

	super fast - pre-compile selector to a query function or xpath expression.

	reliable - not cache result

	documents support - works on both XML/HTML.

## Contact

admin@veryos.com aaron.xiao

## Help

If you have any questions, feel free to <a href="https://github.com/yessky/selector/issues/new" target="_blank">create ticket</a> or <a href="mailto:admin@veryos.com" target="_blank">contact via email</a>.

weibo:  <a href="http://weibo.com/xuanziday" target="_blank">http://weibo.com/xuanziday</a>.

## License

Available under the terms of the <a href="https://github.com/yessky/selector/blob/master/LICENSE.md" target="_blank">MIT License</a>.
