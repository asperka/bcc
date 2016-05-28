var mosca = require('mosca');
var SBrick = require('./sbrick');
var mqtt = require('mqtt');
var app = require('../app');


function log_msg(msg)
{
    console.log (msg);

    app.locals.connections.forEach(function (connObj)
    {
        connObj.ws.emit('log message', msg);
    });
}

var settings = {
  port: 1883,
  // backend: ascoltatore
};

var server = new mosca.Server(settings);

server.on('clientConnected', function(client) {
    console.log('mqtt client connected', client.id);
    if (client.id.lastIndexOf ('ESP8266_')===0) {
        var id = client.id.substring(8);
        if (id) {
            var esp = new bcc8266 (id);
            SBrick.sbricks [id] = esp;
        }
    }
});

// fired when a message is received
server.on('published', function(packet, client) {
  //console.log('Published', packet.payload);
});

// fired when the mqtt server is ready
function setup() {
  console.log('Mosca server is up and running');
}

server.on('ready', setup);

var mqttclient = mqtt.connect('mqtt://localhost');


function bcc8266 (id) {
    this.id = id;
    log_msg('new: ' + this.toString ());
}

bcc8266.prototype.move = function (channel, target) {
    mqttclient.publish ( this.id + "/motor", target.toString ());
    //log_msg('Moving channel '+channel+' to '+target.toString ());
};

bcc8266.prototype.stop = function  (channel) {
    mqttclient.publish ( this.id + "/motor", "0");
    //log_msg('Stopping channel '+channel);
};

bcc8266.prototype.blinkLED = function (timeout) {
    if (!timeout) {
        timeout = 1000;
    }
    mqttclient.publish ( this.id + "/led", "1");
    setTimeout (function () {
        mqttclient.publish ( this.id + "/led", "0");
    }.bind (this), timeout);
};

bcc8266.prototype.connect = function (callback) {
    if (callback) callback (null);
};

bcc8266.prototype.isConnected = function (callback) {
    return true;
};
