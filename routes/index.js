'use strict';
const bs = require('binarysearch');
const express = require('express');
const exec = require('child_process').exec;
const fs = require('fs');
const getLocation = require('./serial_gps');
const http = require('http');
const https = require('https');
const isOnline = require('is-online');
const path = require('path');
const PNG = require('pngjs').PNG;
const tmp = require('tmp');
const urlJoin = require('url-join');
const states = require('./states');

const currentsStations = require('./Currents_Active_Stations.json');
const waterLevelStations = require('./Waterlevel_Active_Stations.json');

const router = express.Router();

/* are we connected to the internets? */
let __online = false;

isOnline({timeout:5000}).then(function(online) {
  console.log('online:', online);
  __online = online;
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

let tilesets = {}

/******************************************************************
 * Return tilesets for a given service, longitude and latitude 
 */
router.get('/tilesets/:srv/:lon/:lat', function(req, res, next) {
  const srv = req.params.srv;
  if (!tilesets[srv]) {
    tilesets[srv] = require('./' + srv + '-layers.json');
  }
  let sets = [];
  const lon = req.params.lon
  const lat = req.params.lat;
  tilesets[srv].map(function(t) {
    if (t.lower[0] < lon && t.lower[1] < lat && t.upper[0] > lon && t.upper[1] > lat) {
      sets.push({
        ident: t.ident,
        height: t.upper[1] - t.lower[1],
        lower: t.lower,
        upper: t.upper
      });
    }
  });
  sets.sort(function(a, b) {
    if (a.height > b.height) return -1;
    if (a.height < b.height) return 1;
    return 0;
  });
  res.end(JSON.stringify(sets));
});


/******************************************************************
 * Supported tile service configurations
 */
var tileService = {
    noaa: {
      host: function() {
        return 'tileservice.charts.noaa.gov';
      },
      url: function(set, x, y, z) {
        return urlJoin('/tiles', set, z, x, y) + '.png';
      }
    },
    osm: {
      host: function(set) {
        return set + '.tile.openstreetmap.org';
      },
      url: function(set, x, y, z) {
        return urlJoin('', z, x, y) + '.png';
      }
    },
    wikimedia: {
      ssl: true,
      host: function() {
        return 'maps.wikimedia.org';
      },
      url: function(set, x, y, z) {
        return urlJoin('', set, z, x, y) + '.png';
      }
    }
};


/******************************************************************
 * Tiles service proxy
 */
router.get('/tiles/:srv/:set/:z/:x/:y', function(req, res, next) {

  const service = tileService[req.params.srv];
  if (!service) {
    var err = new Error('Unrecognized tile service: ' + srv);
    err.status = 503;
    return next(err);
  }

  function checkBounds(tilesets, ident, z, x, y) {
    if (!tilesets) {
      return true;
    }
    for (let i = 0; i != tilesets.length; ++i) {
      const t = tilesets[i];
      if (t.ident===ident) {
        const b = t.tiles[z];
        if (x < b[0] || x > b[2] || y > b[1] || y < b[3]) {
          console.log('*** OUT OF BOUNDS:', ident, [z, x, y], b);
          break;
        }
        return true;
      }
    }
    return false;
  }
  const tset = tilesets[req.params.srv];
  if (!checkBounds(tset, req.params.set, req.params.z, req.params.x, req.params.y)) {
    return res.sendStatus(204);
  }

  function formatTileCacheFileName(req, res, next) {
    let p = req.params;
    let fileName = [ p.set, p.z, p.x, p.y, 'png' ].join('.');
    return urlJoin('tiles', p.srv, p.set, fileName);
  }

  function uploadTile(filePath, req, res, next, callback) {
    let file = fs.createReadStream(filePath);
    file.on('open', function() {
      res.setHeader('content-type', 'image/png');
      file.pipe(res);

      file.on('close', function() {
        res.end();
        if (callback) {
          callback(null);
        }
      });

      file.on('error', function(err) {
        res.end(err);
        if (callback) {
          callback(err);
        }
        return next(err);
      });
    });
  }

  function isEmptyPNG(filePath) {
    let isEmpty = true;
    try {
      const data = fs.readFileSync(filePath);
      const png = PNG.sync.read(data);
      for (let i = 0; i < png.data.length; ++i) {
        if (png.data[i] != 0) {
          isEmpty = false;
          break;
        }
      }
    }
    catch (err) {
      console.log(err.message);
      isEmpty = false;
    }
    return isEmpty;
  }

  function downloadAndUploadTile(filePath, req, res, next, empty) {
    console.log('Downloading: ' + filePath);
    function ensureDirectoryExists(filePath) {
      let dirname = path.dirname(filePath);
      if (fs.existsSync(dirname)) {
        return true;
      }
      ensureDirectoryExists(dirname);
      fs.mkdirSync(dirname);
    }

    try {
      ensureDirectoryExists(filePath);
    }
    catch (err) {
      console.log(err.message);
      return next(err);
    }
    let tmpFileName = null;
    let file = null;

    try {
      tmpFileName = tmp.tmpNameSync();
      file = fs.createWriteStream(tmpFileName);
    }
    catch(err) {
      console.log(err);
      return next(err);
    }
    file.on('error', function(err) {
      console.log(err);
    });
    file.on('open', function() {
      let options = {
        host: service.host(req.params.set),
        path: service.url(req.params.set, req.params.x, req.params.y, req.params.z),
      };

      try {
        var protocol = service.ssl ? https : http;
        let request = protocol.get(options, function(response) {
          response.pipe(file);
          file.on('finish', function() {
            file.close();
            console.log(options.host, response.statusCode);

            if (response.statusCode===200) {

              console.log('Finished downloading: ' + filePath);

              if (isEmptyPNG(tmpFileName)) {
                console.log('Tile is empty: ' + filePath);
                fs.unlink(tmpFileName, function(err) {
                  if (err) {
                    console.log([tmpFileName, err.message]);
                  }
                });
                //
                // update emptyTiles.txt
                //
                const parts = path.basename(filePath).split('.');
                try { 
                  const entry = parts[1] + ' ' + parts[2] + ' ' + parts[3] + '\n';
                  console.log(empty, entry);
                  fs.appendFileSync(empty, entry);
                }
                catch (err) {
                  console.log([empty, parts, err.message]);
                }
                return res.sendStatus(204);
              }
              fs.rename(tmpFileName, filePath, function(err) {
                if (err) {
                  console.log(err.message);
                  uploadTile(tmpFileName, req, res, next, function() {
                    fs.unlink(tmpFileName);
                  });
                }
                else {
                  uploadTile(filePath, req, res, next);
                }
              });
            }
            else {
              fs.unlinkSync(tmpFileName);
              console.log(filePath + ': ' + response.statusMessage);
              res.statusCode = response.statusCode;
              res.send(response.statusMessage);
            }
          });
        });

        request.on('error', function(err) {
          file.close();
          fs.unlinkSync(tmpFileName);
          console.log(err);
          next(err);
        });

        request.end();
      }
      catch (err) {
        file.close();
        fs.unlinkSync(tmpFileName);
        next(err);
      }
    });
  } // function downloadAndUploadTile

  const cachedFilePath = formatTileCacheFileName(req, res, next);

  if (fs.existsSync(cachedFilePath)) {
    uploadTile(cachedFilePath, req, res, next);
  }
  else if (!__online || req.query.source === 'local') {
    res.sendStatus(204);
  }
  else {
    const emptyList = path.normalize(
      __dirname + '/../' + path.dirname(cachedFilePath) + '/emptyTiles.txt');

    const cmd = 'grep "' + req.params.z + ' ' + req.params.x + ' ' + req.params.y + '" ' + emptyList;

    exec (cmd, function(err, stdout, stderr) {
      if (err) {
        downloadAndUploadTile(cachedFilePath, req, res, next, emptyList)
      }
      else {
        console.log(cmd, ':', stdout);
        res.sendStatus(204);
      }
    });
  }
});


//
// https://stackoverflow.com/questions/21279559/geolocation-closest-locationlat-long-from-my-position
//
function getDistanceFromLatLong(lat1,lon1,lat2,lon2) {
  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }

  const dLat = deg2rad(lat2-lat1);  // deg2rad below
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return c;
}

function getDistance(req, st) {
  const params = req.params;
  return getDistanceFromLatLong(
    req.params.lat, req.params.lon,
    st.Latitude, st.Longitude);
}

/******************************************************************
 * Get the nearest NOAA waterlevel station
 * FIXME: pass parameters :lon/:lat -- for consistency
 */
router.get('/nearestWaterLevelStation/:lat/:lon', function(req, res, next) {
  let minDist = 999999;
  let closest = null;
  
  for (let i = 0; i < waterLevelStations.length; ++i) {
    const st = waterLevelStations[i];
    var dist = getDistance(req, st);
    if (dist < minDist) {
      closest = st;
      minDist = dist;
    }
  }

  const result = {
    Id: closest.Id,
    Name: closest.Name,
    State: closest.State == 'None' ? '' : closest.State,
    Latitude: closest.Latitude,
    Longitude: closest.Longitude
  }
  res.send(JSON.stringify(result));
});


/******************************************************************
 * Get the nearest NOAA currents station
 * FIXME: pass parameters :lon/:lat -- for consistency
 */
router.get('/nearestCurrentsStation/:lat/:lon', function(req, res, next) {
  let minDist = 999999;
  let closest = null;
  
  for (let i = 0; i < currentsStations.length; ++i) {
    const st = currentsStations[i];
    var dist = getDistance(req, st);
    if (dist < minDist) {
      closest = st;
      minDist = dist;
    }
  }

  const result = {
    Id: closest.Id,
    Name: closest.Name,
    Latitude: closest.Latitude,
    Longitude: closest.Longitude
  }
  res.send(JSON.stringify(result));
});


/******************************************************************
 *
 */
router.get('/location', function(req, res, next) {
  const loc = getLocation();

  if (!__online && loc.time) {
    exec('sudo date -s "' + loc.time.toString() + '"', function(err, stdout, stderr) {
      if (err) {
        console.log(err.message);
      }
      else {
        console.log('time set:', loc.time.toString());
      }
    });
  }

  //console.log(loc);

  res.send(JSON.stringify(loc));
});


/******************************************************************
 * 
 */
var tides = {}

router.get('/tides/:station/:time', function(req, res, next) {
  const date = new Date(req.params.time);
  const year = date.getUTCFullYear();
  const station = req.params.station;
  if (!tides[station]) {
    tides[station] = require(
      '../tools/tides/' 
      + req.params.station + '/' + year + '/mllw.json');
  }
  if (tides[station].error) {
    var error = new Error(tides[station].error.message);
    error.status = 500;
    return next(error);
  }
  date.setTime(date.getTime() - 12 * 3600 * 1000);
  date.setTime(date.getTime() + date.getTimezoneOffset() * 60000);

  const tidePredictions = tides[station].predictions;
  const start = bs.closest(tidePredictions, date, function(value, find) {
    const dt = new Date(value.t);
    if (dt.getTime() > find.getTime()) {
      return 1;
    }
    else if (dt.getTime() < find.getTime()) {
      return -1;
    }
    return 0;
  });

  var result = new Array(240);

  for (var i = 0; i < 240; ++i) {
    result[i] = tidePredictions[start + i];
  }
  res.send(JSON.stringify({ predictions: result }));
});




let geonames = null;
let stateNames = {};

/******************************************************************
 * Search for location that matches name and is closest to lon-lat
 */
router.get('/search/:name/:lon/:lat', function(req, res, next) {
  
  function getState(s) {
    const val = states(s);
    if (val) {
      s = val[1];
    }
    return s;
  }

  function getStateOrProvince(place) {
    if (place.state) {
      return place.stateName = stateNames[place.state];
    }
  }

  if (!geonames) {
    geonames = require('./geonames.min.json');
    for (let i = 0; i != geonames.length; ++i) {
      const c = geonames[i];
      if (c.state && c.code==='ADM1') {
        stateNames[c.state] = c.name;
      }
    }
  }
  let name = req.params.name.toLowerCase();
  let state = null;

  const tokens = name.split(',');
  if (tokens.length > 1) {
    name = tokens[0].trim();
    state = getState(tokens[1].trim());
  }
  let matches = [];

  for (let i = 0; i != geonames.length; ++i) {
    let c = geonames[i];
    if (state && (!c.state || c.state.toLowerCase() !== state)) {
      continue;
    }
    if (c.name.toLowerCase().includes(name)) {
      c.dist = getDistanceFromLatLong(c.lat, c.lon, req.params.lat, req.params.lon);
      c.dist *= 3440; // nautical miles, for the front-end's convenience

      getStateOrProvince(c, geonames);

      matches.push(c);
    }
  }

  matches.sort(function(a,b) {
    const dist1 = a.dist;
    const dist2 = b.dist;

    if (dist1 < dist2) {
      return -1;
    }
    if (dist1 > dist2) {
      return 1;
    }
    return 0;
  });

  res.send(JSON.stringify(matches.slice(0, 100)));
});


/******************************************************************
 *
 */
router.get('/weather/:lon/:lat', function(req, res, next) {
  if (!__online) {
    return res.sendStatus(204);
  }
  const url = 'http://api.wunderground.com/api/c1537719c680efb0/geolookup/conditions/q/'
    + req.params.lat + ',' + req.params.lon + '.json';

  let data = '';

  http.get(url, function(response) {
    response.on('data', function(chunk) {
      data += chunk;
    });
    response.on('error', function(err) {
      console.log(err);
      return next(err);
    });
    response.on('end', function() {
      const wu = JSON.parse(data).current_observation;
      try {
        const report = {
          //image: wu.image.url,
          image: '/images/wu_logo_130x80.png',
          time: wu.observation_time_rfc822,
          weather: wu.weather,
          temp: wu.temperature_string,
          wind: wu.wind_string,
          wind_degrees: wu.wind_degrees,
          wind_mph: wu.wind_mph,
          humidity: wu.relative_humidity,
          visibility: wu.visibility_mi,
          station: wu.observation_location.full,
        }
        res.end(JSON.stringify(report, null, 4));
      }
      catch(err) {
        console.log(err);
        return next(err);
      }
    });
  })
  .on('error', function(err) {
    console.log(err);
    return next(err);
  })
  .end();
});


module.exports = router;

