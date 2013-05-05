var fs = require('fs');
fs.readFile('xml.xml',function(err, data) {
	var content = String(data).replace(/<a name=([^"]+?)(?=\s|>)/g, '<a name="$1"');
	var html = '<script>\nvar templateString = ';
	html += JSON.stringify(content);
	html += ';</script>';
	fs.writeFile('xml2.html', html);
});