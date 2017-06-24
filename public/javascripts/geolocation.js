
class Geolocation {
  constructor(opt_options) {
    var options = opt_options || {};
    this._timeout = options.timeout ? options.timeout : 3000;
    this._errorCallback = options.onError;
    this._successCallback = options.onSuccess;
  }

  start() {
    if (!this.isTracking()) {
      console.log(this);
      this._sendLocationRequest();
    }
  }

  stop() {
    if (this._watchId) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    else if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  isTracking() {
    return this._watchId || this._intervalId;
  }

  _sendLocationRequest() {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = this._processLocationRequest.bind(this);
    xmlHttp.open('GET', '/location');
    xmlHttp.send();
  }

  _processLocationRequest(e) {
    var xmlHttp = e.currentTarget;
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      var loc = JSON.parse(xmlHttp.responseText);
      if (loc) {
        if (!this._intervalId) {
          //
          // First successful call? Repeat at given interval/timeout
          //
          this._intervalId = 
            setInterval(this._sendLocationRequest.bind(this), this._timeout);
        }
        this._update(loc);
      }
      else {
        if (this._intervalId) {
          clearInterval(this._intervalId);
          this._intervalId = null;
        }
        //
        // Fail over to HTML5 geolocation
        //
        this._watchId = navigator.geolocation.watchPosition(
          this._onSuccess.bind(this),
          this._onError.bind(this),
          {
            enableHighAccuracy: true,
            timeout: this._timeout,
            maximumAge: 0
          });

        if (1 && !this._once 
            && (navigator.platform == 'iPad' || navigator.platform == 'iPhone')) {
          this._once = true;
          window.addEventListener('deviceorientation', function(e) {
            this._heading = e.webkitCompassHeading;
          }.bind(this));
        }
      }
    }
  }

  _onSuccess(pos) {
    var coord = {
      lon: pos.coords.longitude,
      lat: pos.coords.latitude,
      speed: pos.coords.speed,
      heading: pos.coords.heading
    }
    this._update(coord);
  }

  _onError(err) {
    this.stop();
    if (confirm(err.message + ' Retry?')) {
      this.start();
    }
    else if (this._errorCallback) {
      this._errorCallback(err);
    }
  }

  _update(coord) {
    if (!coord.heading && this._heading) {
      coord.heading = this._heading;
    }
    if (this._successCallback) {
      this._successCallback(coord);
    }
  }
}

