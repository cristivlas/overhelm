const fs = require('fs');
const https = require('https');

// Load all chart metadata
const charts = require(__dirname + '/../routes/noaa-layers.json');


const start = new Date();

function getETA(i, n) {
  const now = new Date();
  const speed = i / (now.getTime() - start.getTime());
  const timeLeft = (n - i) / speed;
  let eta = new Date();
  eta.setTime(eta.getTime() + timeLeft);
  return eta;
}

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
var nTiles = -1;


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


function updateStatus(err, tile, done=false) {
  const html = '<html><meta http-equiv="refresh" content="5">'
    + '<body>Process '
    + process.pid + '<div id="start"></div>'
    + '<br>Zoom level: ' + zoom
    + '<br>Charts: ' + tile.i + ' out of ' + charts.length
    + ' (current: ' + charts[tile.i].ident + ')'
    + '<br>Tiles: ' + nTiles
    + '<br><div id="eta"></div>'
    + '</body>'
    + '<script>document.getElementById("start").innerHTML="Started: " + new Date('
    + start.getTime() + ').toLocaleString();document.getElementById("eta").innerHTML='
    + '"ETA: " + new Date('
    + getETA(tile.i, charts.length).getTime() + ').toLocaleString()</script><br>'
    + (err ? err : '') + (done ? '<br>Completed.': '') + '</html>';

  const path = __dirname + '/../public/status-' + zoom + '.html';
  fs.writeFileSync(path, html);
}


function nextTile(tile) {
  ++nTiles;
  ++tile.x;
  if (tile.x > tile.xMax) {
    ++tile.y;
    if (tile.y > tile.yMax) {
      if (!nextChart(tile)) {
        updateStatus(null, tile, true);
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
      if (resp.statusCode===204) {
        console.log([ident, tile.x, tile.y]);
        tile.x = tile.xMax;
        tile.y = tile.yMax;
        return nextTile(tile);
      }

      resp.on('end', function(err) {
        console.log(path);
        updateStatus(err, tile);
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

