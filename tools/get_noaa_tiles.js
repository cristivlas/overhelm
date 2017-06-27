const devnull = require('dev-null');
const https = require('https');
const charts = require('../routes/noaa-layers.json');

// http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function long2tile(lon,zoom) {
  return Math.floor((lon+180)/360*Math.pow(2,zoom));
}

function lat2tile(lat,zoom)  {
  return Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) 
    + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom));
}

function lower_tile(zoom, chart) {
  return {
    x: long2tile(chart.lower[0], zoom),
    y: lat2tile(chart.lower[1], zoom),
  }
}

function upper_tile(zoom, chart) {
  return {
    x: long2tile(chart.upper[0], zoom),
    y: lat2tile(chart.upper[1], zoom),
  }
}

const zoom = process.argv[2] || 12;
var currentTile = { 
  i: -1,
  x: -1,
  y: -1,
  z: zoom,
  xMin: -1,
  xMax: -1,
  yMin: -1,
  yMax: -1,
}

function nextChart(tile) {
  ++tile.i;
  if (tile.i >= charts.length) {
    return false;
  }
  const c = charts[tile.i];
  const lower = lower_tile(tile.z, c);
  const upper = upper_tile(tile.z, c);
  tile.xMin = Math.min(lower.x, upper.x);
  tile.xMax = Math.max(lower.x, upper.x);
  tile.yMin = Math.min(lower.y, upper.y);
  tile.yMax = Math.max(lower.y, upper.y);
  return true;
}


function nextTile(tile) {
  ++tile.x;
  if (tile.x > tile.xMax) {
    ++tile.y;
    if (tile.y > tile.yMax) {
      if (!nextChart(tile)) {
        return false;
      }
      tile.y = tile.yMin;
    }
    tile.x = tile.xMin;
  }
  const ident = charts[tile.i].ident;
  const path = '/tiles/noaa/' + ident + '/' + zoom + '/' + tile.x + '/' + tile.y;

  const options = {
    host: 'localhost',
    path: path,
    port: 3443,
    rejectUnauthorized: false
  }
  try {
    var req = https.get(options, function(resp) {
      resp.pipe(devnull());
      resp.on('end', function(err) {
        console.log(path);
        if (err) {
          console.log(err);
        }
        nextTile(tile);
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

nextTile(currentTile);
