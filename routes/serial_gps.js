'use strict';

const SerialPort = require('serialport');

let location = null;

module.exports = function () {
  return location;
}

const keys = ['time', 'lon', 'lat', 'speed', 'heading' ];
const protocol = 'RMC';

const myports = [ 
  '/dev/ttyACM0', '/dev/ttyUSB0',
  'COM3', 'COM4', 'COM5', 'COM6', 'COM7' 
];

let haveGPS = false;

for (var i = 0; i != myports.length; ++i) {
  const port = new SerialPort(myports[i], {
    baudrate: 4800,
    parser: SerialPort.parsers.readline('\r\n')
  },
  function(err) {
    if (err) {
      console.log(err.message);
    } 
    else if (!haveGPS) {
      haveGPS = true;
      console.log(port.path + ': Ok');

      const GPS = require('gps');
      const gps = new GPS();
     
      gps.on(protocol, function(data) {
        if (data) {
          //console.log(data);
          location = {}
          for (var j = 0; j != keys.length; ++j) {
            const k = keys[j];
            location[k] = data[k];
          }
          if (location.speed > 1.0) {
            location.speed *= 0.539957; // km/h to knots
          }
          else {
            location.speed = 0;
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

if (!haveGPS) {
  location = undefined;
}


