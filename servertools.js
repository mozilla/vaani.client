/**
 * Created by anatal on 7/17/16.
 */
"use strict";

// then all required modules
const fs = require('fs');
const WebSocket = require('ws')
const url = require('url');
const MemoryStream = require('memorystream');

// and set some vars
var ws;
var logStream;
var streamServer;

module.exports = {

    wakeword: null,
    config: null,
    audiotools: null,

    setup: function(wakeword, config, audiotools){
        this.wakeword = wakeword;
        this.config = config;
        this.audiotools = audiotools;

        // creating logs folder if necessary
        if ((this.config.logaudios)) {
            if (!fs.existsSync('logsaudio')){
                fs.mkdirSync('logsaudio');
            }
        }
    },

    connectServer: function (){

        // if we need to apply gain, we setup sox first to give it time to start
        if (this.config.micgain > 0) this.audiotools.setupSox();

        streamServer = new MemoryStream();
        var ssldir = this.config.ssldir;
        var server = this.config.vaaniserver;
        server = url.parse(server, true, false);
        server.query.authtoken = this.config.evernote.authtoken;
        server.pathname = '/';
        var secure = server.protocol == 'wss:';
        server = url.format(server);
        var wstream;
        var isWav;

        var options = {
            rejectUnauthorized: false
        };
        if (secure) {
            options.key =  fs.readFileSync(ssldir + 'client-key.pem');
            options.cert = fs.readFileSync(ssldir + 'client-crt.pem');
            options.ca =   fs.readFileSync(ssldir + 'ca-crt.pem');
            options.passphrase = this.config.passphrase;
        }

        ws = new WebSocket(server, null, options);

        // if we are set to save the audiofiles, then we create it
        if (this.config.logaudios) logStream  = fs.createWriteStream("logsaudio/" +  new Date().getTime(), {'flags': 'a'});

        ws.on('open', () => {
            isWav = false;
            wstream = fs.createWriteStream('output.wav');
        });

        ws.on('message', (data, flags) => {
            if (!isWav){
                console.log(data); //-- TODO add score to metrics
                isWav = true;
                this.wakeword.resume();
                this.wakeword.pause();
            } else {
                wstream.write(data);
            }
        });

        ws.on('close', () => {
            wstream.end();
            this.audiotools.playresponse();
            if (this.config.logaudios) logStream.close();
        });
    },

    streamToServer: function (captureddata) {

        if (this.config.micgain > 0) {
            // here we get the Promise back
            this.audiotools.feedSox(captureddata)
                .then((sampleswgain) => {
                    streamServer.write(sampleswgain);
                })
                .catch((error) => {
                streamServer.write(captureddata); })
        } else {
            streamServer.write(captureddata);
        }

        if (ws.readyState == ws.OPEN) {
            let samples;
            while ((samples = streamServer.read(this.config.VAD_BYTES))) {
                // stream the samples
                ws.send(samples);
                // log the samples
                if (this.config.logaudios) logStream.write(samples)
            }
        }
    },

    endStreamToServer : function () {
        if (ws.readyState == ws.OPEN) {
            ws.send('EOS');
        }
        if (this.config.logaudios) logStream.close();
    }
}