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

    var config = data || {};
    this.title = config.title || "VenueFM";
    this.path  = config.path || path.join(__dirname, "music");
    this.port  = 4821; 

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
        console.log("   info   - ".cyan + "Scanning root directory: '" + this.path + "'");

        try {
            var files = fs.readdirSync(this.path);
            
            files.forEach(function(file) {
                var fullPath = path.join(that.path, file);
                var stat = fs.statSync(fullPath);

                if (stat.isFile()) {
                    var ext = path.extname(file).toLowerCase();
                    if (ext === ".mp3" || ext === ".ogg" || ext === ".wav") {
                        that.can.push("/" + file);
                    }
                }
            });

            console.log("   ok     - ".green + "Found " + that.can.length + " files in root.");

            const wss = new WebSocket.Server({ port: that.port });

            console.log("   info   - ".cyan + "WS Server started, listening on port " + that.port);

            wss.on('connection', function connection(ws) {
                const handshakeData = { title: that.title, event: 'handshake' };
                ws.send(LZString.compressToUTF16(JSON.stringify(handshakeData)));

                ws.on('message', function incoming(message) {
                    // Convert Buffer to String
                    const decompressed = LZString.decompressFromUTF16(message.toString());
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

        } catch (err) {
            console.log("   error  - ".red + "Could not read directory: " + err.message);
        }
    };

    this.nextMusic = function(wss) {
        if (that.can.length === 0 && that.cant.length === 0) return;

        var old = that.can.splice(that.current, 1)[0];

        if (that.can.length === 0) {
            that.can = that.cant;
            if(old) that.can.push(old);
            that.current = that.can.length - 1;
            that.cant = [];
        } else {
            if(old) that.cant.push(old);
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

if (require.main === module) {
    exports.startWsServer();
}
