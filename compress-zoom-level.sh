#! /usr/bin/env bash
set -f
zoom=${1:-*}

pattern=tiles/*/*/*.
pattern+=$zoom
pattern+=.*.*.png

set +f
tar zvcf tiles.`hostname`.`date +%Y%m%d%H%M`.tgz ${pattern}
