const fs = require('fs');
const parse = require('csv-parse');

const filename = process.argv[2];

const opts = {
  delimiter: '\\t',
  relax: true
}

let geonames = []

const parser = parse(opts, function(err, data) {
  if (err) {
    throw err;
  }
  for (let i = 0; i != data.length; ++i) {
    const parts = data[i][0].split('\t');
    const loc = {
      id: parts[0],
      name: parts[1],
      ascii: parts[2],
      aka: parts[3],
      lat: parts[4],
      lon: parts[5]
    }
    geonames.push(loc);
  }
  console.log(JSON.stringify(geonames, 0, 4));
});

fs.createReadStream(filename).pipe(parser);

