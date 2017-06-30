#!/usr/bin/bash

split -l 10000 US.txt geonames
mkdir -p US

for i in geonames*; do
  echo $i
  node mkgeonames.js $i > US/$i.json
done

rm geonames*
