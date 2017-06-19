const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const tmp = require('tmp');
const urlJoin = require('url-join');

const waterLevelStations = require ('./Waterlevel_Active_Stations.json');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


let tilesets = {}

/* return tilesets for a given service, longitude and latitude */
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

/* Tiles service proxy */
router.get('/tiles/:srv/:set/:z/:x/:y.png', function(req, res, next) {

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
    //console.log('Uploading: ' + filePath);
    let file = fs.createReadStream(filePath);
    res.setHeader('content-type', 'image/png');
    file.pipe(res);

    file.on('close', function() {
      //console.log('Finished uploading: ' + filePath);
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
    //console.log(tmpFileName);

    let file = fs.createWriteStream(tmpFileName);
    let options = {
      host: service.host(req.params.set),
      path: service.url(req.params.set, req.params.x, req.params.y, req.params.z),
    };
    //console.log(options.host, options.path);
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
                fs.unlink(tmpFileName);
                next(err);
              }
              else {
                uploadTile(filePath, req, res, next);
              }
            });
          }
          else {
            fs.unlink(tmpFileName);
            res.statusCode = response.statusCode;
            res.send(response.statusMessage);
          }
        });
      });

      request.on('error', function(err) {
        file.close();
        fs.unlink(tmpFileName);
        next(err);
      });
    }
    catch (err) {
      file.close();
      fs.unlink(tmpFileName);
      next(err);
    }
  }

  const cachedFilePath = formatTileCacheFileName(req, res, next);
  //console.log(cachedFilePath);

  if (fs.existsSync(cachedFilePath)) {
    //console.log('File exists: ' + cachedFilePath);
    uploadTile(cachedFilePath, req, res, next);
  }
  else {
    downloadAndUploadTile(cachedFilePath, req, res, next)
  }
});


/******************************************************************
 * Get the nearest NOAA waterlevel station
 */
router.get('/nearestWaterLevelStation/:lat/:lon', function(req, res, next) {
//
// https://stackoverflow.com/questions/21279559/geolocation-closest-locationlat-long-from-my-position
//
  function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
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

  function deg2rad(deg) {
    return deg * (Math.PI/180)
  }

  let minDist = 999999;
  let closest = null;
  
  for (i = 0; i < waterLevelStations.length; ++i) {
    const st = waterLevelStations[i];
    var dist = getDistanceFromLatLonInKm(req.params.lat, req.params.lon, st.Latitude, st.Longitude);
    if (dist < minDist) {
      closest = st;
      minDist = dist;
    }
  }

  const result = {
    Id: closest.Id,
    Name: closest.Name,
    State: closest.State,
    Latitude: closest.Latitude,
    Longitude: closest.Longitude
  }
  res.send(JSON.stringify(result));
});


function formatDateTime(date) {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes()
  return date.getUTCFullYear() + '-' + Math.floor(month / 10) + month % 10 + '-'
    + Math.floor(day / 10) + day % 10 + ' ' + Math.floor(hour / 10)
    + Math.floor(hour % 10) + ':' + Math.floor(minute / 10) + minute % 10;
}


router.get('/mockWaterLevelData/:end', function(req, res, next) {
  let result = { predictions: [] }

  const begin = req.params.end - 24 * 3600 * 1000;
  const end = req.params.end;

  for (t = begin; t < end; t += 3600000) {
    result.predictions.push({
      t: formatDateTime(new Date(t)),
      v: Math.cos(t/(3 * 3600 * 1000)) * 10 + 10
    });
  }
  res.send(JSON.stringify(result));
});


module.exports = router;
