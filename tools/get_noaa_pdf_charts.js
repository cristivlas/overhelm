//
// Download all available NOAA PDF charts
//
const async = require('async');
const cheerio = require('cheerio');
const download = require('./http_download');
const fs = require('fs');

const pdf_list_url = 'http://www.charts.noaa.gov/PDFs/PDFs.shtml';
const pdf_list_file = 'pdfs.html';
const pdf_folder = 'charts';
const parallel_dowload_limit = 16;

let tasks = [];

try {
  fs.mkdirSync(pdf_folder);
}
catch (error) {
  if (error.code != 'EEXIST') {
    throw error;
  }
}

const pdf_download = function(chart, callback) {
    download(chart.url, chart.file, function(err, result) {
        callback(err, result);
        if (!err) {
            console.log(chart.file, ':', chart.title);
        }
    });
}

// Download table of PDF files
download(pdf_list_url, pdf_list_file, function(err, result) {
	if (err) {
		console.log(err);
		return;
	}
	// Scrape with Cheerio and download each PDF
	const htmlText = fs.readFileSync(result).toString();
	const parsedHtml = cheerio.load(htmlText);

	parsedHtml('a').map(function(i, elem) {
		//console.log(elem);
		const href = cheerio(elem).attr('href');
		if (!href.match('.pdf')) {
            return;
        }

		const filename = pdf_folder + '/' + elem.children[0].data + '.pdf';

        // TODO: add some PDF validation
        if (fs.existsSync(filename)) {
            //console.log(filename, 'exits.');
            return;
        }

        // next column in the table is the scale
        const scale = elem.parent.next.children[0].data;
        // expect next column to be the title
        const title = elem.parent.next.next.children[0].data;

        tasks.push(pdf_download.bind(null, {
            title: title, scale: scale, url: href, file: filename}));
        console.log('Queued:', href);
	});

	async.parallelLimit(tasks, parallel_dowload_limit, function(err, results) {
		if (err) {
			console.log(err);
		}
	});
});

