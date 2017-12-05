'use strict'
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var pcmap = {};
var curid;
var i = 1;
var lefttoconnect = 0;
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};
var localVideo = document.querySelector('#localVideo');
var remoteVideo;
var isStreamer = false;
// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

var room = '123456';

var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);                                 //1
}

socket.on('created', function(room, sockid) {
  console.log('Created room ' + room);                                                    //-1
  isInitiator = true;
  isStreamer = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room, ID){
  console.log('Another peer made a request to join room ' + ID);                      //-2 caused by new peer create or join
  console.log('This peer is the initiator of room ' + room + '!');
  isStarted = false;
  isInitiator = true;
  isChannelReady = true;
  curid = ID;
});

socket.on('joined', function(room, ids) {
  console.log('joined: ' + room);
  console.log('room has: ');
  console.log(ids);
  lefttoconnect = Object.keys(ids).length;
  lefttoconnect *= 2;
  isChannelReady = true;
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message, curid);
}

// This client receives a message
socket.on('message', function(message, sockid) {                                                //-3 caused by new peer send got usr media
  // pcmap[curid] = pc;
  // //pc = {cid: 0, sock: 0};
  // curid = sockid;
  //pcmap[curid] = pc;
  // pc = pcmap[sockid];
  // curid = sockid;

  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    //if (!isInitiator && !isStarted) {
      console.log('offer!!!!!!!!!!!!');
      maybeStart();
    //}
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

//var remoteVideo = document.querySelector('#remoteVideo');
if(localStream == undefined) {
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotStream)                                                                      //2
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}
else
{
  if(isStreamer) {
    console.log('Adding local stream.');
    localVideo.src = window.URL.createObjectURL(localStream);
    sendMessage('got user media');                                                      //3
    if (!isInitiator) {
      maybeStart();                                                                     
    }
  }
}

function gotStream(stream) {
  if(isStreamer) {
    console.log('Adding local stream.');
    localVideo.src = window.URL.createObjectURL(stream);
  }
  localStream = stream;
  sendMessage('got user media');                                                      //3
  if (!isInitiator) {
    maybeStart();                                                                     
  }
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);        //4
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');                                    //-4 when new peer send media enterable
    createPeerConnection();
    if(remoteStream != undefined) {
      pc.addStream(remoteStream);
    }
    else
    {
      pc.addStream(localStream);
    }
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (!isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
    sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    do {
      pc = new RTCPeerConnection(pcConfig);
    }while(!pc);
    
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {                                                           //-8 loop invoked by localmedia add
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    try {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } catch(e) {
      isStarted = false;
      pc.close();
    }   
  } else {
    console.log('End of candidates.');
    //lefttoconnect *= 2;
    lefttoconnect = lefttoconnect - 1;
    console.log('lefttoconnect ',lefttoconnect);
    if(lefttoconnect > 0) {
      isInitiator = false;
      isStarted = false;
      maybeStart();
    }
    else
    {
      isStarted = true;
      isInitiator = true;
    }
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
  isStarted = false;
  pc.close();
}

function doCall() {                                                                             //-5 called by maybeStart
  console.log('Sending offer to peer');
  pc.createOffer(sdpConstraints).then(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);                    //-6 success send sdp
  sendMessage(sessionDescription);                                                              //-7 send sdp
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(event) {
  if(remoteStream != undefined) {
    return;
  }
  var remoteVideoID = 'remoteVideo' + i;
  console.log('Remote stream added.', remoteVideoID);
  i = i + 1;
  if(isStreamer) {
    return;
  }
  remoteVideo = document.getElementById(remoteVideoID);
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
  isStarted = false;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  isChannelReady = false;
  pc.close();
  pc = null;
}

