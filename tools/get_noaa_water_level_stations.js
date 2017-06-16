//
// SEE:
// https://idpgis.ncep.noaa.gov/arcgis/services/NOS_Observations/CO_OPS_Stations/MapServer/WFSServer?request=GetCapabilities&service=WFS
//
const fs = require('fs'),
      xml2js = require('xml2js');
      download = require('./http_download');

const parser = new xml2js.Parser();
const file = 'stations.xml';
const url = 'https://idpgis.ncep.noaa.gov/arcgis/services/NOS_Observations/CO_OPS_Stations/MapServer/WFSServer?'
          + 'request=GetFeature&service=WFS&TypeName=CO_OPS_Stations:Waterlevel_Active_Stations'

function lon_lat(obj) {
    let result = obj[0].split(' ');
    return [ parseFloat(result[0]), parseFloat(result[1]) ];
};


function parse_file(file) {
    fs.readFile(file, function(err, data) {
        if (err) {
            throw(err);
        }
        parser.parseString(data, function(err, result) {
            if (err) {
                throw(err);
            }
            result['wfs:FeatureCollection']['gml:featureMember'].map(function(member) {
              console.log(JSON.stringify(member, null, 4));
            });
        });
    });
}

if (fs.existsSync(file)) {
  parse_file(file);
}
else {
  download(url, file, function(err, result) {
      if (err) {
          throw err;
      }
      parse_file(file);
  })
}
