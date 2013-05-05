A Super Fast And Compatible CSS Selector Engine
======

kquery is a pure-JavaScript css selector engine, selectors of css1/2/3 are supported.

## Getting Started

Download the [production version][min] or the [development version][max].

Speed Test At: <a href="http://test.veryos.com/selector/slickspeed/index.html" target="_blank">Slickspeed</a>.

Testsuite At: <a href="http://test.veryos.com/selector/testsuite.html" target="_blank">Testsuite</a>.

[min]: https://raw.github.com/yessky/kquery/master/dist/kquery.min.js
[max]: https://raw.github.com/yessky/kquery/master/dist/kquery.js

In your web page:

```html
<script src="dist/kquery.min.js"></script>
<script>
var a = kquery('#id');
var b = kquery('.class');
var c = kquery('div div');
var d = kquery('div:nth-child(even)');
</script>
```

## Documentation
_(Coming soon)_

## Release History
_(Nothing yet)_

## Features
	compatibility - all major browsers ie6+/chrome/firefox/opera/safari.

	light - 18kb minified, only 5.0kB minified and gzipped.

	super fast - query logic will be pre-optimize by the smart compiler engine.

	reliable - never cache results, query function was cached.

	documents support - works on both XML/HTML.

## Contact

admin@veryos.com aaron.xiao

## Help

If you have any questions, feel free to <a href="https://github.com/yessky/kquery/issues/new" target="_blank">create ticket</a> or <a href="mailto:admin@veryos.com" target="_blank">contact via email</a>.

weibo:  <a href="http://weibo.com/veryos" target="_blank">http://weibo.com/veryos</a>.

## License

kquery is available under the terms of the <a href="https://github.com/yessky/kquery/blob/master/LICENSE.md" target="_blank">MIT License</a>.
