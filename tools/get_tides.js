'use strict';
const fs = require('fs');
const download = require('./http_download');
const path = require('path');
const stations = require('../routes/Waterlevel_Active_Stations.json')

const year = process.argv[2] || '2017';
var current = -1;

function ensureDirectoryExists(filePath) {
  let dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExists(dirname);
  fs.mkdirSync(dirname);
}

function nextStation() {
  ++current;
  if (current >= stations.length) {
    return false;
  }
  const s = stations[current];
  const url = 
    'https://tidesandcurrents.noaa.gov/api/'
    + 'datagetter?product=predictions&format=json&time_zone=GMT&units=english&datum=MLLW'
    + '&begin_date=' + year + '0101&end_date=' + year + '1231&station='
    + s.Id;
  const filepath = __dirname + '/tides/' + s.Id + '/' + year + '/mllw.json';
  ensureDirectoryExists(filepath);
  download(url, filepath, function(err) {
    if (err) {
      throw err;
    }
    else {
      console.log(s.Id);
      nextStation();
    }
  });
  return true;
}

nextStation();

