#! /usr/bin/env bash

# timeZones.txt to JSON

(echo [
tail -n +2 timeZones.txt | cut -f1-4 | while read country tz gmt dst; do
    echo { '"id"':'"'$tz'"','"gmt"':'"'$gmt'"','"dst"':'"'$dst'"' },
done | sed -e ' $s/.$//'
echo ]) > tz.json
