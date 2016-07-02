"use strict";

var Wakeword = require('wakeword');
var MemoryStream = require('memorystream');
var WebSocket = require('ws');
const child_process = require('child_process');
const fs = require('fs');
const MAX_LISTEN_TIME = 7500;
const VAD_BYTES = 640;
const MAX_SIL_TIME = 2500;
var ws;
var streamServer = new MemoryStream();
const call = (command, params) => child_process.spawn(command, params.split(' '));
var lastvadStatus = 0;
var dtStartSilence, totalSilencetime;

function connectServer(){
  ws = new WebSocket('ws://localhost:8080/?token=testtoken', null, { rejectUnauthorized: false });
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
    } else {
      wstream.write(data);
    }
  });

  ws.on('close', () => {
    wstream.end();
    var play = call('play', 'output.wav');
    play.stdout.on('close', () => {
      listen();
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

  Wakeword.listen(['foxy'], 0.83, 'resources/hi.wav', (data, word) => {

    if (!streamvad) {
      connectServer();
      streamvad = new MemoryStream();
      wakeTime = Date.now();
      dtStartSilence = totalSilencetime = null;
    }

    streamvad.write(data);

    //console.log('foxy');
    let samples;
    while ((samples = streamvad.read(VAD_BYTES))) {
      secsSilence = vad(samples);
      streamToServer(samples);
    }

    if ((Date.now() - wakeTime > MAX_LISTEN_TIME) || (secsSilence >=  MAX_SIL_TIME)) {
      var play = call('play', 'resources/end_spot.wav');
      streamvad.end();
      Wakeword.stop();
      endStreamToServer();
    }
  });
}

listen();
