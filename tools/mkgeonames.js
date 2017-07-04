const fs = require('fs');
const https = require('https');
const parse = require('csv-parse');

const maxElevation = 50;
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

const keywords = [
  'airport',
  'anchorage',
  'atoll',
  'bank',
  'bayou',
  'basin',
  'bar',
  'bay',
  'beach',
  'beacon',
  'bluff',
  'boat',
  'bridge',
  'cable',
  'cape',
  'cave',
  'cannery',
  'channel',
  'city',
  'coast',
  'cove',
  'creek',
  'dam',
  'delta',
  'dock',
  'ferry',
  'fish',
  'fisherman',
  'fishery',
  'estuary',
  'gateway',
  'glade',
  'grove',
  'guard',
  'gulf',
  'harbor',
  'harbour',
  'head',
  'isle',
  'islet',
  'island',
  'inlet',
  'jetty',
  'lake',
  'lagoon',
  'landing',
  'ledge',
  'light',
  'lighthouse',
  'locks',
  'marker',
  'marina',
  'marsh',
  'mooring',
  'navy',
  'park',
  'pass',
  'peninsula',
  'pier',
  'point',
  'pond',
  'port',
  'reach',
  'reef',
  'rock',
  'rocks',
  'ridge',
  'river',
  'sand',
  'sandbar',
  'ship',
  'shipyard',
  'shoal',
  'shole',
  'shore',
  'slough',
  'sound',
  'spire',
  'station',
  'strait',
  'sunken',
  'swamp',
  'terminal',
  'tower',
  'town',
  'yard',
  'water',
  'wharf',
  'wreck',
]


Array.prototype.removeEmpty = function() {
  for (let i = 0; i != this.length; ) {
    if (!this[i].length) this.splice(i,1);
    else ++i;
  }
  return this;
}


function filterName(name) {
  const tok = name.toLowerCase().split(' ').removeEmpty();
  if (tok.length <= 2) {
    return true;
  }
  for (let i = 0; i != tok.length; ++i) {
    if (keywords.find(function(elem) {
        return elem === tok[i];
      })) {
      return true;
    }
  }
  return false;
}


const blocked = [
  /^BANK/,
  /^BLDG/,
  /^BLDO/,
  /^CH/,
  /^CMTY/,
  /^HTL/,
  /^MALL/,
  /^REC.*/,
  /^REST/,
  /^RET/,
  /^RLG.*/,
  /^RSRT/,
  /^SCH.*/,
  /^SPA/,
  /^STNE/,
  /^STNR/,
  /^SWT/,
  /^TMB/,
]


function filter(loc) {
  //
  // skip locations that are too high up above sea level
  //
  if (loc.elevation > maxElevation) {
    return false;
  }

  for (let i = 0; i != blocked.length; ++i) {
    if (loc.code.match(blocked[i])) {
      return false;
    }
  }
  return filterName(loc.ascii);
}


//
// TEST
//
if (process.argv[2]==='test') {
  const test = [
    'Grove Hill Academy',
    'Griffins (historical)',
    'New World Academy',
    'Little Stellwagen Basin',
    'Southern California Borderland',
    'Eastern Shore Shopping Center',
    'Highland Park Golf Course',
  ];

  for (let i = 0; i != test.length; ++i) {
    console.log([test[i], filterName(test[i])]);
  }

  let loc = {
    "id": "4065478",
    "name": "Grove Hill Academy",
    "ascii": "Grove Hill Academy",
    "lat": "31.70127",
    "lon": "-87.77472",
    "elevation": "154",
    "code": "SCH",
    "state": "AL",
    "charts": [
        "50000_1",
        "411_1"
    ]
  }
  console.log([loc, filter(loc)]);
  return;
}



function processRecord(data, i) {
  if (i >= data.length) {
    return false;
  }
  let parts = []
  let loc = {}

  for (; i < data.length; ++i) {
    parts = data[i][0].split('\t');
    loc = {
      id: parts[0],
      name: parts[1],
      ascii: parts[2],
      lat: parts[4],
      lon: parts[5],
      elevation: parts[16],
      code: parts[7],
    }

    if (filter(loc)) {
      break;
    }
  }
  if (!filter(loc)) {
    return false;
  }
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
      	console.log(JSON.stringify(loc, null, 4) + ',');
      }
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

