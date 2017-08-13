#! /usr/bin/env bash

stamp=`date +%Y%m%d%H%M`
host=`hostname`
if [ ${host} = localhost ]; then
  host=ragnar
fi

echo $host $stamp

tar zvcf tiles-noaa.${host}.${stamp}.tgz tiles/noaa
tar zvcf tiles-wiki.${host}.${stamp}.tgz tiles/wikimedia
