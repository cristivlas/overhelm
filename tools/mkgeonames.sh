#!/usr/bin/bash

prefix=geonames-

rm -f ${prefix}*

split --lines=20000 --suffix-length=2 US.txt $prefix

rm -rf US
mkdir -p US

for i in ${prefix}*; do
  echo $i
  node --max_old_space_size=8192 mkgeonames.js $i > US/$i.json
done

rm ${prefix}*
