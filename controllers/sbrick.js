
var noble = require('noble');
var app = require('../app');


function log_msg(msg)
{
    console.log (msg);

    app.locals.connections.forEach(function (connObj)
    {
        connObj.ws.emit('log message', msg);
    });
}

function SBrick (peripheral) {
    this.peripheral = peripheral;
    this.sendbuf = new Buffer([0x01, 0x00, 0x00, 0x00]);
    this.targets = [0,0,0,0];
    this.current = [0,0,0,0];
    this.acc = [10,10,10,10];
    this.forceupdate = [false, false, false, false];
    this.maxoutput = 254;
    this.HWMajor = 0;
    this.HWMinor = 0;
    this.FWMajor = 0;
    this.FWMinor = 0;
    this.checkfirmware ();

    peripheral.on('disconnect', function (peripheral) {
        log_msg ('disconnect: '+this.id);
        if (SBrick.sbricks.hasOwnProperty(this.id)) {
            SBrick.sbricks[this.id].disconnect ();
        }

    });

    log_msg('new: ' + this.toString ());

}

SBrick.sbricks = {};
exports.sbricks = SBrick.sbricks;

SBrick.prototype.isConnected = function () {
    return (this.peripheral.state === 'connected');
};

SBrick.prototype.disconnect = function () {
    clearInterval (this.updateID);
    if (this.peripheral.state === 'connected') {
        this.peripheral.disconnect ();
    }
};

SBrick.prototype.connect = function (callback) {

    if (this.peripheral.state !== 'connected') {
        log_msg ('connect');
        this.peripheral.connect (function (error) {
            noble.stopScanning();
            log_msg ('getting char for ' + this.peripheral.id);
            //console.log ('connected SBrick! '+ peripheral.id);
             var suuid =['4dc591b0857c41deb5f115abda665b0c'];
            // //var cuuid = ['489a6ae0c1ab4c9cbdb211d373c1b7fb']; // quick drive
             var cuuid = ['02b8cbcc0e254bda8790a15f53e6010f']; // remote control commands
             this.peripheral.discoverSomeServicesAndCharacteristics(suuid, cuuid, function (error, services, characteristics) {
                 log_msg ('got char for ' + this.peripheral.id);
                 this.characteristics = characteristics[0];
                 noble.startScanning();
                 if (callback) callback (null);
            }.bind (this) );
        }.bind (this));
    } else {
        log_msg ('already connected');
        if (callback) callback (null);
    }
};

SBrick.prototype.toString = function () {
    var result = "SBrick, ID "+ this.peripheral.id;
    result += ", Hardware "  + this.HWMajor +'.' +this.HWMinor;
    result += ', Firmware '+ this.FWMajor +'.' +this.FWMinor;
    return result;
};

SBrick.prototype.move = function (channel, target) {
    if (target > this.maxoutput) {
        target = this.maxoutput;
    }
    if (target<-this.maxoutput) {
        target = -this.maxoutput;
    }
    log_msg('Moving channel '+channel+' to '+target);
    this.targets [channel] = target;
};

SBrick.prototype.stop = function  (channel) {
    this.forceupdate [channel] = true;
    this.targets[channel] = 0;
    this.current[channel] = 0;
    log_msg('Stopping channel '+channel);
};

SBrick.prototype.checkfirmware = function () {
    if (this.peripheral.advertisement.manufacturerData)
    {
        var data = this.peripheral.advertisement.manufacturerData;
        this.HWMajor = data[5];
        this.HWMinor = data[6];
        this.FWMajor = data[7];
        this.FWMinor = data[8];
    }
    if (this.FWMajor > 4) {
        this.maxoutput = 255;
    } else if (this.FWMajor == 4) {
        if (this.FWMinor >=2) {
            this.maxoutput = 255;
        }
    }

};

SBrick.prototype.updatetask = function () {
    var sent = false;
    for (var i=0; i<4; i++)
    {
        var diff = this.targets[i] - this.current[i];
        if (diff !== 0 || this.forceupdate[i])
        {
            if (diff > this.acc[i]) {
                diff = this.acc[i];
            } else if (diff < -this.acc[i]) {
                diff = -this.acc[i];
            }
            this.current[i] += diff;
            this.sendbuf[1] = i;
            if (this.current[i] > 0) {
                this.sendbuf[2] = 1;
            } else {
                this.sendbuf[2] = 0;
            }
            this.sendbuf[3] = Math.abs(this.current[i]);
            this.characteristics.write(this.sendbuf);
            sent = true;
            this.forceupdate[i] = false;
        }
    }
    if (!sent)
    {
        this.characteristics.write(this.sendbuf);
    }
};

SBrick.prototype.startUpdating = function (callback) {

    this.sendbuf = new Buffer([0x01, 0x00, 0x00, 0x00]);
    this.targets = [0,0,0,0];
    this.current = [0,0,0,0];
    this.forceupdate = [false, false, false, false];

    this.updateID = setInterval ( this.updatetask.bind(this), 250);
    log_msg('startUpdating: ' + this);
    if (callback) {
        callback ();
    }
};


noble.on('discover', function(peripheral) {
    log_msg('discover');
    if (peripheral.advertisement) {
        if (peripheral.advertisement.localName) {
            if (peripheral.advertisement.localName == 'SBrick') {
                var s = SBrick.sbricks[peripheral.id];
                if (!s) {
                    s = new SBrick(peripheral);
                    SBrick.sbricks [peripheral.id]=s;
                }
            }
        }
    }

});

noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        log_msg('startScanning');
        noble.startScanning();
    } else {
        log_msg('stopScanning');
        noble.stopScanning();
    }
});
