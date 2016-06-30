var Wakeword = require('wakeword');
var MemoryStream = require('memorystream');
var WebSocket = require('ws');

const MAX_LISTEN_TIME = 7500;
const VAD_BYTES = 640;
var ws;
var streamServer = new MemoryStream();

function connectServer(){
  console.log('connecting to server');
  ws = new WebSocket('wss://localhost:8080/?token=testtoken', null, { rejectUnauthorized: false });


  ws.on('open', () => {
    console.log("socket opened");
  });


  ws.on('message', (data, flags) => {
    console.log('message from server rcvd:' );
  });

  ws.on('close', () => {
    console.log('message closed from srv');
  });
}

function streamToServer(data) {
  console.log('Sending data to server');
  streamServer.write(data);
  var samples;
  if (ws.readyState == ws.OPEN) {
    console.log("entrando no while de ler samples " );

    while ((samples = streamServer.read(VAD_BYTES))) {
      console.log("sending to server...");
      ws.send(samples);
    }
  } else {
    console.log("not connected yet");
  }
}

function endStreamToServer() {
  console.log('Ending stream to server');
  if (ws.readyState == ws.OPEN) {
    ws.send('EOS');
  } else {
    console.log("not connected yet");
  }
}

function vad(data) {
  if (!data) {
    return true;
  }

  // TODO: return false if no activity detected.
  console.log('data.... Vad:' +  Wakeword.decoder.processWebrtcVad(data));

  return true;
}

function listen() {
  var streamvad = null;
  var wakeTime = 0;

  Wakeword.listen(['foxy'], 0.83, (data, word) => {

    if (!streamvad) {
      connectServer();
      streamvad = new MemoryStream();
      wakeTime = Date.now();
    }

    streamvad.write(data);

    console.log('foxy');

    while ((samples = streamvad.read(VAD_BYTES))) {
      vad(samples);
      streamToServer(samples);
    }

    if (Date.now() - wakeTime > MAX_LISTEN_TIME) {
      streamvad.end();
      Wakeword.stop();
      endStreamToServer();
      listen();
      console.log("Parado e reiniciado")
    }
  });
}

listen();
