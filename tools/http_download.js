const http = require('http');
const fs = require('fs');


module.exports = function(url, dest, cb) {
	const file = fs.createWriteStream(dest);
	try {
		var request = http.get(url, function(response) {
			response.pipe(file);
			file.on('finish', function() {
				file.close(cb.bind(null, null, dest));
			});
		}).on('error', function(err) {
			fs.unlink(dest);
			if (cb) {
				cb(err);
			}
		});
	}
	catch(err) {
		cb(err);
	}
}
