const fs = require('fs');
const URL = require('url');

module.exports = function(url, dest, cb) {
  const protocol = URL.parse(url).protocol == 'https:' ? require('https') : require('http');
	const file = fs.createWriteStream(dest);
	try {
		var request = protocol.get(url, function(response) {
			response.pipe(file);
			file.on('finish', function() {
        if (response.statusCode != 200) {
          cb(new Error(response.statusMessage));
        }
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
