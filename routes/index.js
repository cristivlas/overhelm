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
const tmp = require('tmp');
const urlJoin = require('url-join');

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
      sets.push({ident: t.ident, height: t.upper[1] - t.lower[1]});
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
    err.status = 500;
    return next(err);
  }

  function formatTileCacheFileName(req, res, next) {
    let p = req.params;
    let fileName = [ p.set, p.z, p.x, p.y, 'png' ].join('.');
    return urlJoin('tiles', p.srv, p.set, fileName);
  }

  function uploadTile(filePath, req, res, next) {
    let file = fs.createReadStream(filePath);
    res.setHeader('content-type', 'image/png');
    file.pipe(res);

    file.on('close', function() {
      res.end();
    });

    file.on('error', function(err) {
      res.end(err);
    });
  }

  function downloadAndUploadTile(filePath, req, res, next) {
    console.log('Downloading: ' + filePath);
    function ensureDirectoryExists(filePath) {
      let dirname = path.dirname(filePath);
      if (fs.existsSync(dirname)) {
        return true;
      }
      ensureDirectoryExists(dirname);
      fs.mkdirSync(dirname);
    }

    ensureDirectoryExists(filePath);
    const tmpFileName = tmp.tmpNameSync();

    let file = fs.createWriteStream(tmpFileName);
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

          if (response.statusCode == 200) {
            console.log('Finished downloading: ' + filePath);
            fs.rename(tmpFileName, filePath, function(err) {
              if (err) {
                fs.unlinkSync(tmpFileName);
                next(err);
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
        next(err);
      });

      request.end();
    }
    catch (err) {
      file.close();
      fs.unlinkSync(tmpFileName);
      next(err);
    }
  }

  const cachedFilePath = formatTileCacheFileName(req, res, next);

  if (fs.existsSync(cachedFilePath)) {
    uploadTile(cachedFilePath, req, res, next);
  }
  else if (!__online || req.query.source === 'local') {
    res.send();
  }
  else {
    downloadAndUploadTile(cachedFilePath, req, res, next)
  }
});


//
// https://stackoverflow.com/questions/21279559/geolocation-closest-locationlat-long-from-my-position
//
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2-lat1);  // deg2rad below
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function getDistance(req, st) {
  const params = req.params;
  return getDistanceFromLatLonInKm(
    req.params.lat, req.params.lon,
    st.Latitude, st.Longitude);
}

/******************************************************************
 * Get the nearest NOAA waterlevel station
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
    exec('date -s "' + loc.time.toString() + '"', function(err, stdout, stderr) {
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

  for (var i = 0; i <= 240; ++i) {
    result[i] = tidePredictions[start + i];
  }
  res.send(JSON.stringify({ predictions: result }));
});


module.exports = router;
