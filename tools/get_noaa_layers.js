//
// Utility for generating noaa-layers.json 
//
const fs = require('fs'),
      xml2js = require('xml2js');
      download = require(__dirname + '/http_download');

const parser = new xml2js.Parser();
const file = 'noaa.xml';
const url = 'http://tileservice.charts.noaa.gov/tiles/wmts/1.0.0/WMTSCapabilities.xml';

// http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function long2tile(lon, zoom) {
  return Math.floor((lon+180)/360*Math.pow(2,zoom));
}

function lat2tile(lat, zoom)  {
  return Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) 
    + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom));
}

function lon_lat(obj) {
    let result = obj[0].split(' ');
    return [ parseFloat(result[0]), parseFloat(result[1]) ];
}

function xy(lower, upper) {
  let tiles = []
  for (let z = 0; z < 18; ++z) {
    tiles.push([
      long2tile(lower[0], z),
      lat2tile(lower[1], z),
      long2tile(upper[0], z),
      lat2tile(upper[1], z)
    ]);      
  }
  return tiles;
}

function toJSON(file) {
    fs.readFile(file, function(err, data) {
        if (err) {
            throw(err);
        }
        parser.parseString(data, function(err, result) {
            if (err) {
                throw(err);
            }
            let layers = [];

            result.Capabilities.Contents[0].Layer.map(function(layer) {

                // console.log(JSON.stringify(layer, null, 2));

                const ident = layer['ows:Identifier'][0];
                const bbox = layer['ows:WGS84BoundingBox'][0];

                const lower = lon_lat(bbox['ows:LowerCorner']);
                const upper = lon_lat(bbox['ows:UpperCorner']);
                layers.push({
                  ident: ident,
                  upper: upper,
                  lower: lower,
                  tiles: xy(lower, upper)
               });
            });

            //console.log(JSON.stringify(layers, null, 4));
            console.log(JSON.stringify(layers));
        });
    });
}


if (fs.existsSync(file)) {
    toJSON(file);
    return;
}


download(url, file, function(err, result) {
    if (err) {
        throw err;
    }
    toJSON(result);
})

