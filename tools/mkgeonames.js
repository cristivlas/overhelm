const fs = require('fs');
const https = require('https');
const parse = require('csv-parse');

const maxElevation = 50; // meters
const filename = process.argv[2];

const parseOpt = {
  delimiter: '\\t',
  relax: true
}

let httpsOpt = {
  host: 'localhost',
  port: 3443,
  rejectUnauthorized: false
}


function processNextRecordAsync(data, i, callback) {
  new Promise(function(resolve) {
    try {
      processRecord(data, i);
      resolve();
    }
    catch(err) {
      if (callback) {
        callback(err);
      }
    }
  }).then(processNextRecordAsync.bind(this, data, i+1));
}


function processRecord(data, i) {
  if (i >= data.length) {
    return false;
  }
  let parts = []
  let loc = {}
  do {
    parts = data[i][0].split('\t');
    loc = {
      id: parts[0],
      name: parts[1],
   // ascii: parts[2],
      lat: parts[4],
      lon: parts[5],
      elevation: parts[16]
    }

    if (loc.elevation <= maxElevation) {
      break;
    }
    //
    // skip locations that are too high up above sea level
    //
    //console.error('Skip:', i, loc.name);

  } while(++i < data.length);

  if (parts[10]) {
    loc.state = parts[10];
  }

  let charts = '';

  httpsOpt.path = '/tilesets/noaa/' + loc.lon + '/' + loc.lat;

  let req = https.get(httpsOpt, function(resp) {
    resp.on('end', function(err) {
      if (err) {
        return;
      }
      charts = JSON.parse(charts);
      const len = charts.length;
      if (len) {
        loc.charts = []
        for (let j = 0; j != len; ++j) {
          loc.charts.push(charts[j].ident);
        }
      }
      console.log(JSON.stringify(loc, null, 4) + ',');
      
      return processRecord(data, ++i);
    });

    resp.on('data', function(chunk) {
      charts += chunk;
    });
  });
  req.end();
  return true;
}


const parser = parse(parseOpt, function(err, data) {
  if (err) {
    throw err;
  }
  processRecord(data, 0);
});


fs.createReadStream(filename).pipe(parser);

