const https = require('https');
const geonames = require(__dirname + '/../routes/geonames.json');

const srv = process.argv[2] || 'noaa';

// http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function long2tile(lon,zoom) {
  return Math.floor((lon+180)/360*Math.pow(2,zoom));
}

function lat2tile(lat,zoom)  {
  return Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) 
    + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom));
}

const minZoom = 3;
const maxZoom = 16;

let tile = { 
  i: -1,
  zoom: maxZoom,
  nChart: -1,
  charts: []
}


function nextTileAsync(callback) {
  new Promise(function(resolve, reject) {
    try {
      nextTile();
      const result = resolve();
      if (result && callback) {
        callback(null);
      }
    }
    catch(err) {
      console.log(err);
      if (callback) {
        callback(err);
      }
      else reject(err);
    }
  });
}


function nextTile() {
  if (++tile.zoom > maxZoom) {
    tile.zoom = minZoom;
    if (++tile.nChart >= tile.charts.length) {
      if (++tile.i >= geonames.lenght) {
        return false;
      }
      tile.nChart = 0;
      tile.charts = geonames[tile.i].charts || [];
      if (!tile.charts.length) {
        return nextTileAsync();
      }
    }
  }
  const ident = tile.charts[tile.nChart];
  console.log('[' + geonames[tile.i].ascii + ']', ident, 'zoom:' + tile.zoom);
  const x = long2tile(parseFloat(geonames[tile.i].lon), tile.zoom);
  const y = lat2tile(parseFloat(geonames[tile.i].lat), tile.zoom);
  let path = '/tiles/' + srv + '/' + ident + '/' + tile.zoom + '/' + x + '/' + y;
  console.log(path);

  const options = {
    host: 'localhost',
    path: path,
    port: 3443,
    rejectUnauthorized: false
  }
  try {
    var req = https.get(options, function(resp) {
      resp.on('end', function(err) {
        console.log(path);
        if (err) {
          console.log(err);
        }
        nextTile();
      });

      resp.on('data', function(chunk) {
      });
    });

    req.on('error', function(err) {
      console.log(err);
    });

    req.end();
  }
  catch (err) {
    console.log (err);
  }
  return true;
}

nextTile();
