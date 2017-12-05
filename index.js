'use strict';

function pausecomp(millis)
{
    var date = new Date();
    var curDate = null;
    do { curDate = new Date(); }
    while(curDate-date < millis);
}

var socketIO = require('socket.io');
var https = require('https');
var fs = require('fs');
var express = require('express');
var path = require('path');

var options = {
  key: fs.readFileSync('./file.pem'),
  cert: fs.readFileSync('./file.crt')
};

var serverPort = 9000;

var exp = express();

var server = https.createServer(options, exp);

exp.use(express.static(path.join(__dirname, 'public')));

var IDP = {};
var arridp = [];
var storenewid = [];
var retrnid;
var i = 1;
var statecode;
var flip = 0;
var accumu = 0;
var answeracc = 0;

var app = server.listen(serverPort, function() {
  console.log('server up and running at %s port', serverPort);
});


var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
  }

  socket.on('message', function(message, sendid) {
    log('Client said: ', message);
    if(message === 'bye') {
      console.log('Client ID ' + socket.id + ' left room ');
      delete IDP[socket.id];
      var index = arridp.indexOf(socket.id);
      arridp.splice(index, 1);
    }
    if(message.type === 'offer') {
      var key;
      if(statecode != socket.id) {
        storenewid = [];
      }
      for(var index = arridp.length - 1; index >= 0; index--) {
        key = arridp[index];
        if(key != socket.id && !storenewid.includes(key)) {
          if(statecode != socket.id) {
            statecode = socket.id;
            flip = 1;
            accumu = 1;
            answeracc = 0;
            storenewid = [];
          }
          else
          {
            flip = 0;
            accumu = accumu + 1;
          }
          
          sendid = key;

          //storenewid.push(sendid);
          console.log('array containes: ', storenewid);
          retrnid = socket.id;
          console.log('offer: ', socket.id, ' send to ', sendid);
          break;
        } 
      }
    }
    else if(message.type === 'answer') {
      sendid = retrnid;
      setTimeout(
        function(){ 
          console.log(sendid, ' ', statecode);
          console.log(answeracc, ' ', accumu, ' ', flip);
          if(sendid == statecode) {
            
            answeracc = answeracc + 1;
            // if(answeracc > accumu) {
            //   return;
            // }

          }
          else
          {

            answeracc = answeracc + 1;
            // if(answeracc > accumu) {
            //   return;
            // }
          }
          console.log('answer: ', socket.id, ' send to ', sendid);
          io.of("/").to(sendid).emit('message', message, socket.id);
          i = 3
        }, i*50);
      pausecomp(4000);
      return;
    }

    // for a real app, would be room-only (not broadcast)
    if(sendid == null) {
      //console.log('INFO: ' , socket.id, ' broadcast: ', ' sendID: ', sendid);
      socket.broadcast.emit('message', message, socket.id);
    }
    else
    {
      //console.log('INFO: ', sendid, ' receive message ');
      io.of("/").to(sendid).emit('message', message, socket.id);
    } 
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var numClients = io.sockets.sockets.length;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 1) {
      console.log('Client ID ' + socket.id + ' created room ');
      socket.join(room);
      //console.log('Client ID ' + socket.id + ' created room ' + room);
      IDP[socket.id] = 1;
      arridp.push(socket.id);
      //console.log('INFO: ', socket.id, ' receive message created');
      socket.emit('created', room, socket.id);

    } else if (numClients >= 2) {
      console.log('Client ID ' + socket.id + ' joined room ');
      //console.log(io.sockets.in(room));
     // console.log('INFO: ', socket.id, ' join broadcast');
      arridp.push(socket.id);
      io.sockets.in(room).emit('join', room, socket.id);
      socket.join(room);
     // console.log('INFO: ', socket.id, ' receive list');
      socket.emit('joined', room, IDP);
      IDP[socket.id] = 1;
    } else { // unlimited clients
      socket.emit('full', room);
    }
  });
});
