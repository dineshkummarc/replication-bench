// copyright 2011 Couchbase
// 
// how many devices can a single database support for shared replication?
// w/ option to filter
var FILTER = false
    , CONTINUOUS = true
    , LOAD = "photos"
    ;

var coux = require('coux').coux
    , e = require('errlog').e
    , fs = require('fs')
    , url = require('url')
    , load = require(__dirname + '/' + LOAD)
    , measure = require(__dirname + '/measure')
    ;


function asyncFold(array, fun, done) {
    // console.log('asyncFold',array.length, array)
    var offset = -1
        , cb = function() {
            offset++;
            if (offset < array.length) {
                fun(array[offset], cb)
            } else {
                done();
            }
        };
    cb();
};


// first database is the master
var dbs = fs.readFileSync(__dirname + "/dbs.txt", "utf8").split(/\n/);


// create databases (first one is master)
asyncFold(dbs, function(db, cb) {
    coux.put(db, (function(e, ok) {
        if (e && e.error != "file_exists") {
            console.log(e)
        } else {
            cb()
        }
    }))
}, function() {
    // setup replication from devices <-> master
    var master = dbs[0]
        , dbs2 = dbs.slice(1)
        ;
    
    asyncFold(dbs2, function(db, cb) {
        var rpc = url.parse(db)
            , dbName = rpc.pathname.split('/')[1];
        rpc.pathname = "/_replicate";
        var replicator = url.format(rpc);
        coux.post(replicator, {
            continuous : CONTINUOUS,
            source : dbName,
            target : master
        }, function() {
            coux.post(replicator, {
                continuous : CONTINUOUS,
                source : master,
                target : dbName
            }, function() {
                cb()
            });
        })
    }, function() {
        console.log("replication is running, start the load & the measurement")
        measure.start(dbs, function(notify) {
            load.start(notify, dbs2);
        })
    });
    
});

