#!/usr/bin/env bash

prefix=geonames-
country=${1:-US}
echo $country

rm -f ${prefix}*

split -l 20000 -a 2 ${country}.txt $prefix

rm -rf ${country}
mkdir -p ${country}

for i in ${prefix}*; do
  echo $i
  node --max_old_space_size=8192 mkgeonames.js $i > ${country}/$i.json
done

rm ${prefix}*

# (echo [ && cat ${country}/${prefix}* && echo ]) > geonames.json
#(echo [ && sed '$ s/.$//' ${country}/${prefix}* && echo ]) > geonames.json
