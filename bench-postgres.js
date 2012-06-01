var pg = require('pg');

var count = parseInt(process.argv[2]);
var query = "SELECT NOW()";

var options = {
	user: 'relive',
	database: 'relive',
	host: '192.168.48.15',
	port: '6432'
};

var r = 0;
var e = 0;
function callback(err, res) {
	if (err !== null) {
		e++;
	}

	r++;
	if (r == count) {
		console.log('[NODE-POSTGRES] R ', r, 'E ', e, 'T ', Date.now() - t);
		process.exit();
	}
}

var t = Date.now();
var i = 0;
while (i < count) {
	pg.connect(options, function(err, client) {
		if (client === null) {
			e++;
			r++;
		} else {
			client.query(query, callback);
		}
	});
	i++;
}



