#! /usr/bin/env bash
set -f
zoom=$1
output=tiles.`hostname`.`date +%Y%m%d%H%M`.tgz
if [ -z $zoom ]; then
  zoom=*
else
  output=tiles-${zoom}.`hostname`.`date +%Y%m%d%H%M`.tgz
fi

pattern=tiles/*/*/*.
pattern+=$zoom
pattern+=.*.*.png

echo $output
echo $pattern

set +f
tar zvcf ${output} ${pattern}
