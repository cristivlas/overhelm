#! /usr/bin/env bash
set -f
zoom=$1
output=tiles.`hostname`.`date +%Y%m%d%H%M`.tar
if [ -z $zoom ]; then
  zoom=*
else
  output=tiles-${zoom}.`hostname`.`date +%Y%m%d%H%M`.tar
fi

pattern=tiles/*/*/*.
pattern+=$zoom
pattern+=.*.*.png

echo $output
echo $pattern > manifest.txt
tar vcf ${output} manifest.txt
set +f
for i in ${pattern}; do
  tar --append -v --file=${output} $i
done
gzip ${output}
