"use strict";

var Wakeword = require('wakeword');
var MemoryStream = require('memorystream');
var WebSocket = require('ws');
const child_process = require('child_process');
const fs = require('fs');
const MAX_LISTEN_TIME = 7500;
const VAD_BYTES = 640;
const MAX_SIL_TIME = 2500;
const url = require('url');
const ssldir = './resources/ssl/';

var ws;
var streamServer = new MemoryStream();
const call = (command, params) => child_process.spawn(command, params.split(' '));
const callSync = (command, params) => child_process.spawnSync(command, params.split(' '));

var lastvadStatus = 0;
var dtStartSilence, totalSilencetime;
const config = JSON.parse(process.env.VAANI_CONFIG || fs.readFileSync("config.json"));

function connectServer(){
  var server = config.vaaniserver;
  server = url.parse(server, true, false);
  server.query.authtoken = config.evernote.authtoken;
  server.pathname = '/';
  server = url.format(server);

  var options = {
    rejectUnauthorized: false
  };
  if (config.secure) {
    options.key =  fs.readFileSync(ssldir + 'client-key.pem');
    options.cert = fs.readFileSync(ssldir + 'client-crt.pem');
    options.ca =   fs.readFileSync(ssldir + 'ca-crt.pem');
    options.passphrase = config.passphrase;
  }

  ws = new WebSocket(server, null, options);
  var wstream;
  var isWav;

  ws.on('open', () => {
    isWav = false;
    wstream = fs.createWriteStream('output.wav');
});


  ws.on('message', (data, flags) => {
    if (!isWav){
      console.log(data);
      isWav = true;
      Wakeword.resume();
      Wakeword.pause();
    } else {
      wstream.write(data);
    }
  });

  ws.on('close', () => {
    wstream.end();
    var play = call('play', 'output.wav');
    play.stdout.on('close', () => {
      Wakeword.resume();
    });
  });
}

function streamToServer(data) {
  streamServer.write(data);
  var samples;
  if (ws.readyState == ws.OPEN) {
    while ((samples = streamServer.read(VAD_BYTES))) {
      ws.send(samples);
    }
  }
}

function endStreamToServer() {
  if (ws.readyState == ws.OPEN) {
    ws.send('EOS');
  }
}

function vad(data) {
  if (!data) {
    return MAX_SIL_TIME;
  }

  var vadStatus = Wakeword.decoder.processWebrtcVad(data);

  if (lastvadStatus == 1 && vadStatus == 0){
    dtStartSilence = Date.now();
  } else if (lastvadStatus == 0 && vadStatus == 0 && dtStartSilence){
    totalSilencetime = Date.now() - dtStartSilence;
  } else if (lastvadStatus == 0 && vadStatus == 1) {
    totalSilencetime = 0;
  }

  lastvadStatus = vadStatus;

  return totalSilencetime;
}

function listen() {
  var streamvad = null;
  var wakeTime = 0;
  var secsSilence = 0;

  Wakeword.listen([config.wakeword], 0.83, (data, word) => {

        let samples;

        if (!streamvad) {
          Wakeword.mic.pause();
          callSync('play', 'resources/hi.wav');
          Wakeword.mic.resume();
          connectServer();
          streamvad = new MemoryStream();
          wakeTime = Date.now();
          dtStartSilence = totalSilencetime = null;
        }

        streamvad.write(data);

        while ((samples = streamvad.read(VAD_BYTES))) {
          secsSilence = vad(samples);
          streamToServer(samples);
        }

        if ((Date.now() - wakeTime > MAX_LISTEN_TIME) || (secsSilence >=  MAX_SIL_TIME)) {
          var play = call('play', 'resources/end_spot.wav');
          streamvad.end();
          streamvad = null;
          Wakeword.resume();
          Wakeword.pause();
          endStreamToServer();
        }

  });
}

listen();
