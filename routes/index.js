'use strict';
const bs = require('binarysearch');
const express = require('express');
const exec = require('child_process').exec;
const fs = require('fs');
const geoTZ = require('geo-tz');
const isCustomHardware = false;
const getLocation = isCustomHardware ? require(__dirname + '/serial_gps') : null;
const http = require('http');
const https = require('https');
const isOnline = require('is-online');
const noaa = require(__dirname + '/noaa-metadata.json');
const os = require('os');
const path = require('path');
const PNG = require('pngjs').PNG;
const states = require(__dirname + '/states');
const tmp = require('tmp');
const urlJoin = require('url-join');
const navAids = require(__dirname + '/AidsToNavigation.json');
//const zlib = require('zlib');

const currentsStations = require(__dirname + '/Currents_Active_Stations.json');
const waterLevelStations = require(__dirname + '/Waterlevel_Active_Stations.json');

const router = express.Router();

geoTZ.createPreloadedFeatureProvider();

/* are we connected to the internets? */
let __online = false;

checkConnection();


function checkConnection() {
  isOnline({timeout:5000}).then(function(online) {
    console.log('online:', online);
    __online = online;
  });
}


function logError(err) {
  console.log(err.stack);
}


router.get('/', function(req, res, next) {
  res.redirect('mynav.html');
});


let tilesets = {}


function tilesetInfo(t) {
  const md = noaa.metadata[t.ident.split('_')[0]];
  let sounding = null;
  let scale = 100000000;
  let poly = null;
  if (md) {
    sounding = md.sounding;
    for (let i = 0; i != md.extent.length; ++i) {
      if (md.extent[i].name===t.ident) {
        poly = md.extent[i].poly;
        scale = md.extent[i].scale;
        break;
      }
    }
  }
  return {
    ident: t.ident,
    sounding: sounding,
    scale: scale,
    lower: t.lower,
    upper: t.upper,
    poly: poly
  };
}

/*
const sortTilesets = function(sets) {
  sets.sort(function(a, b) {
    if (a.height > b.height) return -1;
    if (a.height < b.height) return 1;
    return 0;
  });
  return sets;
}
*/

/******************************************************************
 *
 */
router.get('/charts/noaa/', function(req, res, next) {
  const srv = 'noaa';
  if (!tilesets[srv]) {
    tilesets[srv] = require(__dirname + '/' + srv + '-layers.json');
  }
  let sets = [];
  tilesets[srv].map(function(t) {
    sets.push(tilesetInfo(t));
  });
  const result = JSON.stringify(sets);
  res.end(result);
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
  //if (req.params.srv === 'wikimedia') {
  //  return serveWikimediaTile(req, res, next);
  //}
  serveTile(req, res, next);
});


/******************************************************************
 * serve wiki tile only when
 * 1) no NOAA tile with same z,x,y exist
 * 2) the tile is part of a multi-page chart (_1, _2, etc)
 */
function serveWikimediaTile(req, res, next) {
  const index = path.normalize(__dirname + '/../tiles-index/' + req.params.z);
  const cmd = 'grep "' + req.params.x + ' ' + req.params.y + '" ' + index + ' | cut -d" " -f3';

  exec (cmd, function(err, stdout, stderr) {
    if (err) {
      return serveTile(req, res, next);
    }
    else {
      const a = JSON.parse('["' + stdout.trim().replace(/\n/g, '","') + '"]');
      for (let i = 0; i < a.length; ++i) {
        const fpath = path.normalize(__dirname + '/../tiles/noaa/' + a[i].replace(/_./, '_2'));
        if (fs.existsSync(fpath)) {
          return serveTile(req, res, next);
        }
      }
      console.log(cmd, a);
      return res.sendStatus(204);
    }
  });
}

function handleEmptyTile(req, res, next) {
  return res.sendStatus(204);
}


function serveTile(req, res, next) {

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

  const service = tileService[req.params.srv];
  if (!service) {
    var err = new Error('Unrecognized tile service: ' + srv);
    err.status = 503;
    return next(err);
  }
  const tset = tilesets[service];

  if (!checkBounds(tset, req.params.set, req.params.z, req.params.x, req.params.y)) {
    return handleEmptyTile(req, res, next);
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

  function downloadAndUploadTile(filePath, req, res, next, empty) {
    console.log('Downloading: ' + filePath);

    const isEmptyPNG = function(data) {
      let isEmpty = true;
      try {
        const png = PNG.sync.read(data);
        for (let i = 0; i < png.data.length; ++i) {
          if (png.data[i] != 0) {
            isEmpty = false;
            break;
          }
        }
      }
      catch (err) {
        logError(err);
        isEmpty = false;
      }
      return isEmpty;
    }

    const ensureDirectoryExists = function(filePath) {
      const dirname = path.dirname(filePath);
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
      logError(err);
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
        const protocol = service.ssl ? https : http;
        const request = protocol.get(options, function(response) {

          if (response.statusCode!==200) {
            fs.unlinkSync(tmpFileName);
            console.log(filePath + ': ' + response.statusMessage);
            res.statusCode = response.statusCode;
            return res.send(response.statusMessage);
          }

          let tiledata = []
          response.on('end', function() {
            tiledata = Buffer.concat(tiledata);
            file.write(tiledata);
            file.end();
          });

          response.on('data', function(chunk) {
            tiledata.push(chunk);
          });

          file.on('finish', function() {
            file.close();
            console.log(filePath, response.statusCode);

            if (isEmptyPNG(tiledata)) {
              console.log('Tile is empty: ' + filePath);
              fs.unlink(tmpFileName, function(err) {
                if (err) {
                  console.log([tmpFileName, err.message]);
                }
              });
              // update emptyTiles.txt
              const parts = path.basename(filePath).split('.');
              try {
                const entry = parts[1] + ' ' + parts[2] + ' ' + parts[3] + '\n';
                console.log(empty, entry);
                fs.appendFileSync(empty, entry);
              }
              catch (err) {
                console.log([empty, parts, err.message]);
              }
              return handleEmptyTile(req, res, next);
            }
            // commit the file
            fs.rename(tmpFileName, filePath, function(err) {
              if (err) {
                logError(err);
                uploadTile(tmpFileName, req, res, next, function() {
                  fs.unlink(tmpFileName);
                });
              }
              else {
                uploadTile(filePath, req, res, next);
              }
            });
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
  try {
    if (fs.existsSync(cachedFilePath)) {
      uploadTile(cachedFilePath, req, res, next);
    }
    else if (!__online || req.query.source === 'local') {
      return handleEmptyTile(req, res, next);
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
          // console.log(cmd, ':', stdout);

          return handleEmptyTile(req, res, next);
        }
      });
    }
  }
  catch (err) {
    console.log(err);
    return nex(err);
  }
}

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

  //get timezone offset
  const moment = geoTZ.tzMoment(req.params.lat, req.params.lon);

  const result = {
    Id: closest.Id,
    Name: closest.Name,
    State: closest.State == 'None' ? '' : closest.State,
    Latitude: closest.Latitude,
    Longitude: closest.Longitude,
    tzOffset: moment.format('Z').split(':')[0] * 3600 * 1000
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
  if (!isCustomHardware) {
    return res.sendStatus(204);
  }
  const loc = getLocation();
  if (loc===undefined) {
    return res.sendStatus(204);
  }
  if (!__online && loc.time) {
    exec('sudo date -s "' + loc.time.toString() + '"', function(err, stdout, stderr) {
      if (err) {
        logError(err);
      }
      else {
        console.log('time set:', loc.time.toString());
      }
    });
  }
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
  const nearby = name==='nearby';

  for (let i = 0; i != geonames.length; ++i) {
    let c = geonames[i];
    if (state && (!c.state || c.state.toLowerCase() !== state)) {
      continue;
    }
    if (nearby || c.name.toLowerCase().includes(name)) {
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


router.get('/shutdown/:arg', function(req, res, next) {

  const interfaces = os.networkInterfaces();
  for (let k in interfaces) {
    const iface = interfaces[k]
    for (let k in iface) {
      const a = iface[k];
      if (a.address===req.connection.remoteAddress) {
        if (req.params.arg==='supported') {
          return res.send(true);
        }
        else if (req.params.arg==='now' || req.params.arg==='reboot') {
          let cmd = 'sudo shutdown now';
          if (req.params.arg==='reboot') {
            cmd += ' -r';
          }
          exec(cmd, function(err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            if (err) {
              return next(err);
            }
            return res.send(true);
          });
          return;
        }
      }
    }
  }

  res.send(false);
});


/******************************************************************
 *
 */
router.get('/navaids/:lon1/:lat1/:lon2/:lat2', function(req, res, next) {
  let result = []

  const lon1 = parseFloat(req.params.lon1);
  const lat1 = parseFloat(req.params.lat1);
  const lon2 = parseFloat(req.params.lon2);
  const lat2 = parseFloat(req.params.lat2);

  for (let i = 0; i != navAids.features.length; ++i) {
    const f = navAids.features[i];
    if (f.geometry.coordinates[0] > lon1
     && f.geometry.coordinates[1] > lat1
     && f.geometry.coordinates[0] < lon2
     && f.geometry.coordinates[1] < lat2) {

     result.push({
      name: f.properties.name,
      desc: f.properties.structure,
      prop: f.properties.characteristics,
      coord: f.geometry.coordinates,
     });
    }
  }
  res.send(JSON.stringify(result));
});


module.exports = router;

