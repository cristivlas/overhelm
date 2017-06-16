//
// Utility for generating noaa-layers.json 
//
const fs = require('fs'),
      xml2js = require('xml2js');
      download = require('./http_download');

const parser = new xml2js.Parser();
const file = 'noaa.xml';
const url = 'http://tileservice.charts.noaa.gov/tiles/wmts/1.0.0/WMTSCapabilities.xml';

function lon_lat(obj) {
    let result = obj[0].split(' ');
    return [ parseFloat(result[0]), parseFloat(result[1]) ];
};

download(url, file, function(err, result) {
    if (err) {
        throw err;
    }        
    fs.readFile(file, function(err, data) {
        if (err) {
            throw(err);
        }
        parser.parseString(data, function(err, result) {
            if (err) {
                throw(err);
            }
            let layers = [];
            //console.dir(result);

            result.Capabilities.Contents[0].Layer.map(function(layer) {
                //console.log(layer);
                const ident = layer['ows:Identifier'][0];
                const bbox = layer['ows:WGS84BoundingBox'][0];
                //console.log(bbox);
                const lower = lon_lat(bbox['ows:LowerCorner']);
                const upper = lon_lat(bbox['ows:UpperCorner']);
                layers.push({ident: ident, upper: upper, lower: lower});
            });

            console.log(JSON.stringify(layers, null, 4));
        });
    });
});
