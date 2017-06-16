//
// See:
// https://idpgis.ncep.noaa.gov/arcgis/services/NOS_Observations/CO_OPS_Stations/MapServer/WFSServer
// ?request=GetCapabilities&service=WFS
//
const fs = require('fs'),
      xml2js = require('xml2js');
      download = require('./http_download');

const wfsURL = 'https://idpgis.ncep.noaa.gov/arcgis/services/NOS_Observations/CO_OPS_Stations/MapServer/WFSServer?';
const parser = new xml2js.Parser();


function parse_file(file, type, callback) {
  console.log(file, type);
  fs.readFile(file + '.xml', function(err, data) {
    if (err) {
        throw(err);
    }
    parser.parseString(data, function(err, result) {
      if (err) {
          throw(err);
      }
      let output = [];

      result['wfs:FeatureCollection']['gml:featureMember'].map(function(member) {
        member = member[type][0];
        let station = {}
        Object.keys(member).map(function(key) {
          const prop = member[key][0];
          key = key.split(':')[1];
          if (key) {
            station[key] = prop;
          }
        });
        output.push(station);
      });
      fs.writeFileSync(file + '.json', JSON.stringify(output, null, 4));
      if (callback) {
        callback();
      }
    });
  });
}


function download_stations(type, callback) {
  file = type.split(':')[1];
  const xmlFile = file + '.xml';
  if (fs.existsSync(xmlFile)) {
    parse_file(file, type, callback);
  }
  else {
    const url = wfsURL + 'request=GetFeature&TypeName=' + type;
    download(url, xmlFile, function(err, result) {
      if (err) {
        throw(err);
      }
      parse_file(file, type, callback);
    });
  }
}

download_stations('CO_OPS_Stations:Waterlevel_Active_Stations',
download_stations.bind(null, 'CO_OPS_Stations:Currents_Active_Stations'));
 

