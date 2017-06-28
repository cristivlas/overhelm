'use strict';

const exec = require('child_process').exec;
const isOnline = require('is-online');
const SerialPort = require('serialport');

let location = null;

module.exports = {
  online: false,

  getLocation: function () {

    if (!this.online && location.time) {
      exec('date -s "' + location.time.toString() + '"', function(err, stdout, stderr) {
        if (err) {
          console.log(err);
        }
        else {
          console.log('time set:', location.time.toString());
        }
      });
    }

    return location;
  }
}

isOnline({timeout:5000}).then(function(online) {
  console.log('online:', online);
  module.exports.online = online;
});


const keys = ['time', 'lon', 'lat', 'speed', 'heading' ];
const protocol = 'RMC';

const myports = [ 
  '/dev/ttyACM0', '/dev/ttyUSB0',
  'COM3', 'COM4', 'COM5', 'COM6', 'COM7' 
];


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
          location.speed *= 0.539957; // km/h to knots
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

