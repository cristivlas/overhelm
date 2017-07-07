(echo [ && cat US/geonames-* && sed '$ s/.$//' CA/geonames-* && echo ]) > geonames.json

