var WebSocket = require('ws'),
    fs        = require('fs-extra'),
    colors    = require('colors'),
    LZString  = require('lz-string'),
    EventEmitter = require('events'),
    path      = require('path');

function venue(data) {
    console.log("   info   - ".cyan + "venue instance created");

    var that = this;
    EventEmitter.call(this);

    if (data !== undefined) {
        this.title = (data.title === undefined ? "VenueFM" : data.title);
        this.path  = (data.path === undefined ? path.join(__dirname, "music") : data.path);
        this.port  = 4821; 
    }

    this.can     = [];
    this.cant    = [];
    this.current = -1;

    this.on("broadcast", function(wss, payload) {
        const compressedPayload = LZString.compressToUTF16(JSON.stringify(payload));
        
        wss.clients.forEach(function(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(compressedPayload);
            }
        });
    });

    this.startWsServer = function() {
        console.log("   info   - ".cyan + "Started to find files in directory '" + this.path + "'");

        fs.walk(this.path)
            .on('data', function(item) {
                if (item.stats.isFile()) {
                    var ext = path.extname(item.path).toLowerCase();
                    if (ext === ".mp3" || ext === ".ogg" || ext === ".wav") {
                        var relativePath = item.path.replace(that.path, "");
                        that.can.push(relativePath);
                    }
                }
            })
            .on('end', function() {
                console.log("   ok     - ".green + "Found the following number of files: " + that.can.length);

                const wss = new WebSocket.Server({ port: that.port });

                console.log("   info   - ".cyan + "WS Server started, listening on port " + that.port);

                wss.on('connection', function connection(ws) {
                    const handshakeData = { title: that.title, event: 'handshake' };
                    ws.send(LZString.compressToUTF16(JSON.stringify(handshakeData)));

                    ws.on('message', function incoming(message) {
                        const decompressed = LZString.decompressFromUTF16(message);
                        let parsed;
                        
                        try {
                            parsed = JSON.parse(decompressed);
                        } catch(e) {
                            return;
                        }

                        if (parsed.event === 'handshake' || parsed.event === 'next') {
                            that.nextMusic(wss);
                        }
                    });
                });

                that.emit('ready');
            });
    };

    this.nextMusic = function(wss) {
        if (that.can.length === 0 && that.cant.length === 0) return;

        var old = that.can.splice(that.current, 1);

        if (that.can.length === 0) {
            that.can = that.cant;
            that.current = that.can.length - 1;
            that.can.push(old);
            that.cant = [];
        } else {
            if(old.length > 0) that.cant.push(old);
            that.current = Math.floor(Math.random() * that.can.length);
        }

        const trackPath = that.can[that.current];
        console.log("   info   - ".cyan + "Broadcasting " + trackPath);

        this.emit("broadcast", wss, { event: 'pop', path: trackPath });
        this.emit('play', trackPath);
    }
}

require('util').inherits(venue, EventEmitter);

exports.startWsServer = function(data) {
    var v = new venue(data);
    v.startWsServer();
    return v;
};
