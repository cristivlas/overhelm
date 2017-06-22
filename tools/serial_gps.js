'use strict';
const myports = [ '/dev/ttyUSB0', 'COM5', 'COM7' ];

const SerialPort = require('serialport');
const keys = ['time', 'lon', 'lat', 'speed', 'heading' ];
const protocol = 'RMC';
var location = null;

for (var i = 0; i != myports.length; ++i) {
  const port = new SerialPort(myports[i], {
    baudrate: 4800,
    parser: SerialPort.parsers.readline('\r\n')
  },
  function(err) {
    if (err) {
      console.log(err.message);
    } 
    else {
      console.log(port.path + ': Ok');

      const GPS = require('gps');
      const gps = new GPS();
     
      gps.on(protocol, function(data) {
        if (data) {
          location = {}
          for (var j = 0; j != keys.length; ++j) {
            const k = keys[j];
            location[k] = data[k];
          }
        }
      });
    
      port.on('data', function(data) {
        if (data) {
          gps.update(data);
        }
      });

      const stopGPS = function(error) {
        if (error) {
          console.log(error);
        }
        gps.off(protocol);
      };

      port.on('error', stopGPS);
      port.on('close', stopGPS);
      port.on('disconnect', stopGPS);
    }
  });
}

module.exports = function() {
  return location;
}

