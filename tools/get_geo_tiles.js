const fs = require('fs');
const https = require('https');
const geonames = require(__dirname + '/../routes/geonames.json');

const start = new Date();

function getETA(i, n) {
  if (i > n) {
    i = n;
  }
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

const minZoom = 13;
const maxZoom = 17;

let tile = { 
  i: -1,
  zoom: maxZoom,
  nChart: -1,
  charts: []
}

let nTiles = 0;

function updateStatus(done=false) {
  const html = '<html><meta http-equiv="refresh" content="5">'
    + '<body>Process '
    + process.pid + '<div id="start"></div>'
    + '<br>Locations: ' + tile.i + ' out of ' + geonames.length
    + '<br>Current: ' + geonames[tile.i].ascii + ', ' + geonames[tile.i].state
    + '<br>Charts: ' + geonames[tile.i].charts
    + '<br>Tiles: ' + nTiles
    + '<br><div id="eta"></div>'
    + '</body>'
    + '<script>document.getElementById("start").innerHTML="Started: " + new Date('
    + start.getTime() + ').toLocaleString();document.getElementById("eta").innerHTML='
    + '"ETA: " + new Date('
    + getETA(tile.i, geonames.length).getTime() + ').toLocaleString()</script><br>'
    + (done ? '<br>Completed.': '')
    + '</html>';

  const path = __dirname + '/../public/status-geo.html';
  fs.writeFileSync(path, html);
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
        updateStatus(true);
        return false;
      }
      updateStatus();
      tile.nChart = 0;
      tile.charts = geonames[tile.i].charts || [];
      if (!tile.charts.length) {
        return nextTileAsync();
      }
      for (let i = 0; i != tile.charts.length; ++i) {
        tile.charts[i] = 'noaa/' + tile.charts[i];
      }
      tile.charts.push('wikimedia/osm-intl');
    }
  }
  const ident = tile.charts[tile.nChart];
  console.log(tile.i + '/' + geonames.length
    + ' [' + geonames[tile.i].ascii + ']', ident, 'zoom:' + tile.zoom);
  const x = long2tile(parseFloat(geonames[tile.i].lon), tile.zoom);
  const y = lat2tile(parseFloat(geonames[tile.i].lat), tile.zoom);
  let path = '/tiles/' + ident + '/' + tile.zoom + '/' + x + '/' + y;
  console.log(path);

  const options = {
    host: 'localhost',
    path: path,
    port: 3443,
    rejectUnauthorized: false
  }
  try {
    var req = https.get(options, function(resp) {
      if (resp.statusCode===200) {
        ++nTiles;
      }
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
