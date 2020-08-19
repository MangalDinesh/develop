import React from 'react'
import { merge } from 'lodash'
import AgoraRTC from 'agora-rtc-sdk'

import './canvas.css'
import '../../assets/fonts/css/icons.css'

const tile_canvas = {
  '1': ['span 12/span 24'],
  '2': ['span 12/span 12/13/25', 'span 12/span 12/13/13'],
  '3': ['span 6/span 12', 'span 6/span 12', 'span 6/span 12/7/19'],
  '4': ['span 6/span 12', 'span 6/span 12', 'span 6/span 12', 'span 6/span 12/7/13'],
  '5': ['span 3/span 4/13/9', 'span 3/span 4/13/13', 'span 3/span 4/13/17', 'span 3/span 4/13/21', 'span 9/span 16/10/21'],
  '6': ['span 3/span 4/13/7', 'span 3/span 4/13/11', 'span 3/span 4/13/15', 'span 3/span 4/13/19', 'span 3/span 4/13/23', 'span 9/span 16/10/21'],
  '7': ['span 3/span 4/13/5', 'span 3/span 4/13/9', 'span 3/span 4/13/13', 'span 3/span 4/13/17', 'span 3/span 4/13/21', 'span 3/span 4/13/25', 'span 9/span 16/10/21'],
}


/**
 * @prop appId uid
 * @prop transcode attendeeMode videoProfile channel baseMode
 */
class AgoraCanvas extends React.Component {
  constructor(props) {
    super(props)
    this.client = {};
    this.screenShareClient = null;
    this.localStream  = {
  camera: {
    id: "",
    stream: null
  },
  screen: {
    id: "",
    stream: null
  }
};
    this.shareClient = {}
    this.shareStream = {}
    this.screenVideoProfile = '720p_2';
    this.channelName = 'Testing'
    this.state = {
      displayMode: 'pip',
      streamList: [],
      readyState: false,
      screenShareState: 'inactive'
    }
  }

  componentWillMount() {
    let $ = this.props
    // create screen share client
    this.screenShareClient = AgoraRTC.createClient({ mode: $.transcode });
    // create video client
    this.client = AgoraRTC.createClient({ mode: $.transcode });

    // default init videoClient
    this.initVideoClient();
    
  }

  // init AgoraRTC local video client
  initVideoClient = () => {
    let $ = this.props;
    const token = this.generateToken();
    this.client.init($.appId, () => {
      console.log("AgoraRTC video client initialized")
      this.subscribeStreamEvents()
      this.client.join(token, $.channel, $.uid, (uid) => {
        console.log("User " + uid + " join channel successfully")
        console.log('At ' + new Date().toLocaleTimeString())
        // create local stream
        // It is not recommended to setState in function addStream
        const videoStreem = this.streamInit(uid, $.attendeeMode, $.videoProfile);
        this.localStream.camera.stream = videoStreem;
        this.localStream.camera.id = uid;
        videoStreem.init(() => {
          if ($.attendeeMode !== 'audience') {
            this.addStream(videoStreem, true)
            this.client.publish(videoStreem, err => {
              console.log("Publish local stream error: " + err);
            })
          }
          this.setState({ readyState: true })
        },
          err => {
            console.log("getUserMedia failed", err)
            this.setState({ readyState: true })
          })
      })
    })
  }

  componentDidMount() {
    // add listener to control btn group
    let canvas = document.querySelector('#ag-canvas')
    let btnGroup = document.querySelector('.ag-btn-group')
    canvas.addEventListener('mousemove', () => {
      if (global._toolbarToggle) {
        clearTimeout(global._toolbarToggle)
      }
      btnGroup.classList.add('active')
      global._toolbarToggle = setTimeout(function () {
        btnGroup.classList.remove('active')
      }, 2000)
    })
  }

  // componentWillUnmount () {
  //     // remove listener
  //     let canvas = document.querySelector('#ag-canvas')
  //     canvas.removeEventListener('mousemove')
  // }

  componentDidUpdate() {
    // rerendering
    let canvas = document.querySelector('#ag-canvas')
    // pip mode (can only use when less than 4 people in channel)
    if (this.state.displayMode === 'pip') {
      let no = this.state.streamList.length
      if (no > 4) {
        this.setState({ displayMode: 'tile' })
        return
      }
      this.state.streamList.map((item, index) => {
        let id = item.getId()
        let dom = document.querySelector('#ag-item-' + id)
        if (!dom) {
          dom = document.createElement('section')
          dom.setAttribute('id', 'ag-item-' + id)
          dom.setAttribute('class', 'ag-item')
          canvas.appendChild(dom);
          item.play('ag-item-' + id)
        } else {
          // check if it doesn't contains video tag then play it
          let videoElem = document.querySelector('#video' + id)
          if(!videoElem)
          item.play('ag-item-' + id)
        }
        if (index === 0) {
          dom.setAttribute('style', `grid-area: span 12/span 24/13/25`)
        }
        else {
          dom.setAttribute('style', `grid-area: span 3/span 4/${4 + 3 * index}/25;
                    z-index:1;width:calc(100% - 20px);height:calc(100% - 20px)`)
        }

       // item.player.resize && item.player.resize()


      })
    }
    // tile mode
    else if (this.state.displayMode === 'tile') {
      let no = this.state.streamList.length
      this.state.streamList.map((item, index) => {
        let id = item.getId()
        let dom = document.querySelector('#ag-item-' + id)
        if (!dom) {
          dom = document.createElement('section')
          dom.setAttribute('id', 'ag-item-' + id)
          dom.setAttribute('class', 'ag-item')
          canvas.appendChild(dom)
          item.play('ag-item-' + id)
        }
        dom.setAttribute('style', `grid-area: ${tile_canvas[no][index]}`)
        item.player && item.player.resize && item.player.resize()


      })
    }
    // screen share mode (tbd)
    else if (this.state.displayMode === 'share') {

    }
  }

  componentWillUnmount () {
    this.handleExit(null)
  }

  streamInit = (uid, attendeeMode, videoProfile, config) => {
    let defaultConfig = {
      streamID: uid,
      audio: true,
      video: true,
      screen: false
    }

    switch (attendeeMode) {
      case 'audio-only':
        defaultConfig.video = false
        break;
      case 'audience':
        defaultConfig.video = false
        defaultConfig.audio = false
        break;
      default:
      case 'video':
        break;
    }

    let stream = AgoraRTC.createStream(merge(defaultConfig, config))
    stream.setVideoProfile(videoProfile)
    return stream
  }

  subscribeStreamEvents = () => {
    let rt = this
    rt.client.on('stream-added', (evt) =>  {
      let stream = evt.stream;
      const streamId = stream.getId();
      console.log("New stream added: " + stream.getId())
      console.log('At ' + new Date().toLocaleTimeString())
      console.log("Subscribe ", stream);
      // check  if the stream is local stream  then do not subscribe
      // if (streamId !== this.localStream.camera.id && streamId !== this.localStream.screen.id) {
      //   rt.client.subscribe(stream, function (err) {
      //     console.log("Subscribe stream failed", err)
      //   })
      // } else {
      //   rt.addStream(stream)
      // }

      rt.client.subscribe(stream, function (err) {
        console.log("Subscribe stream failed", err)
      })
    })

    rt.client.on('peer-leave', function (evt) {
      console.log("Peer has left: " + evt.uid)
      console.log(new Date().toLocaleTimeString())
      console.log(evt)
      rt.removeStream(evt.uid)
    })

    rt.client.on('stream-subscribed', function (evt) {
      let stream = evt.stream
      console.log("Got stream-subscribed event")
      console.log(new Date().toLocaleTimeString())
      console.log("Subscribe remote stream successfully: " + stream.getId())
      console.log(evt)
      rt.addStream(stream)
    })

    rt.client.on("stream-removed", function (evt) {
      let stream = evt.stream
      console.log("Stream removed: " + stream.getId())
      console.log(new Date().toLocaleTimeString())
      console.log(evt)
      rt.removeStream(stream.getId())
    })
  }

  removeStream = (uid) => {
    this.state.streamList.map((item, index) => {
      if (item.getId() === uid) {
        item.close()
        let element = document.querySelector('#ag-item-' + uid)
        if (element) {
          element.parentNode.removeChild(element)
        }
        let tempList = [...this.state.streamList]
        tempList.splice(index, 1)
        this.setState({
          streamList: tempList
        })
      }

    })
  }

  addStream = (stream, push = false) => {
    let repeatition = this.state.streamList.some(item => {
      return item.getId() === stream.getId()
    })
    if (repeatition) {
      return
    }
    if (push) {
      this.setState({
        streamList: this.state.streamList.concat([stream])
      })
    }
    else {
      this.setState({
        streamList: [stream].concat(this.state.streamList)
      })
    }

  }

  handleCamera = (e) => {
    e.currentTarget.classList.toggle('off')
    this.localStream.camera.stream.isVideoOn() ?
    this.localStream.camera.stream.disableVideo() : this.localStream.camera.stream.enableVideo()
  }

  handleMic = (e) => {
    e.currentTarget.classList.toggle('off')
    this.localStream.camera.stream.isAudioOn() ?
    this.localStream.camera.stream.disableAudio() : this.localStream.camera.stream.enableAudio()
  }

  handleScreenShare = (e) => {
    e.currentTarget.classList.toggle('off');
    // initiate share screen
    this.initScreenShare()
  }
  // SCREEN SHARING
 initScreenShare = () =>  {
  this.screenShareClient.init(this.props.appId, () => {
    console.log("AgoraRTC screenClient initialized");
    this.joinChannelAsScreenShare();
   // screenShareActive = true;
    // TODO: add logic to swap button
    
  }, function (err) {
    console.log("[ERROR] : AgoraRTC screenClient init failed", err);
  });  
}

 joinChannelAsScreenShare = () =>  {
   const token = this.generateToken();
  const userID = null; // set to null to auto generate uid on successfull connection
   this.screenShareClient.join(token, this.props.channel, userID, (uid) => {
     
    this.localStream.screen.id = uid;  // keep track of the uid of the screen stream.
    
    // Create the stream for screen sharing.
    var screenStream = AgoraRTC.createStream({
      streamID: uid,
      audio: false, // Set the audio attribute as false to avoid any echo during the call.
      video: false,
      screen: true, // screen stream
     // extensionId: 'minllpmhdgpndnkomcoccfekfegnlikg', // Google Chrome:
      mediaSource: 'screen', // Firefox: 'screen', 'application', 'window' (select one)
      screenAudio: true
    });
    screenStream.setScreenProfile(this.screenVideoProfile); // set the profile of the screen
    screenStream.init(() => {
      console.log("getScreen successful");
      this.localStream.screen.stream = screenStream; // keep track of the screen stream
     // $("#screen-share-btn").prop("disabled",false); // enable button
     this.screenShareClient.publish(screenStream, function (err) {
        console.log("[ERROR] : publish screen stream error: " + err);
     });
      
     this.localStream.screen.stream.on('stopScreenSharing', (evt) =>  {
      //  console.log("screen sharing stopped", err);
        this.stopScreenShare()
      });
    }, (err) =>  {
      console.log("[ERROR] : getScreen failed", err);
      this.localStream.screen.id = ""; // reset screen stream id
      this.localStream.screen.stream = {}; // reset the screen stream
      // screenShareActive = false; // resest screenShare
      this.toggleScreenShareBtn(); // toggle the button icon back (will appear disabled)
    });
  }, function(err) {
    console.log("[ERROR] : join channel as screen-share failed", err);
  });

  this.screenShareClient.on('stream-published', (evt) => {
    console.log("Publish screen stream successfully");
   // this.localStream.camera.stream.disableVideo(); // disable the local video stream (will send a mute signal)
   // this.localStream.camera.stream.stop(); // stop playing the local stream
    // TODO: add logic to swap main video feed back from container
   // remoteStreams[mainStreamId].stop(); // stop the main video stream playback
  //  this.addRemoteStreamMiniView(remoteStreams[mainStreamId]); // send the main video stream to a container
    // localStreams.screen.stream.play('full-screen-video'); // play the screen share as full-screen-video (vortext effect?)
  //  $("#video-btn").prop("disabled",true); // disable the video button (as cameara video stream is disabled)
  });
  
  
}

 stopScreenShare = () =>  {
  this.localStream.screen.stream.disableVideo(); // disable the local video stream (will send a mute signal)
  this.localStream.screen.stream.stop(); // stop playing the local stream
  this.localStream.camera.stream.enableVideo(); // enable the camera feed
  //this.localStream.camera.stream.play('local-video'); // play the camera within the full-screen-video div
  //$("#video-btn").prop("disabled",false);
  this.screenShareClient.leave(()=> {
    // screenShareActive = false; 
    console.log("screen client leaves channel");
   // $("#screen-share-btn").prop("disabled",false); // enable button
   this.screenShareClient.unpublish(this.localStream.screen.stream); // unpublish the screen client
    this.localStream.screen.stream.close(); // close the screen client stream
    this.localStream.screen.id = ""; // reset the screen id
    this.localStream.screen.stream = {}; // reset the stream obj
  }, function(err) {
    console.log("client leave failed ", err); //error handling
  }); 
}

  switchDisplay = (e) => {
    if (e.currentTarget.classList.contains('disabled') || this.state.streamList.length <= 1) {
      return
    }
    if (this.state.displayMode === 'pip') {
      this.setState({ displayMode: 'tile' })
    }
    else if (this.state.displayMode === 'tile') {
      this.setState({ displayMode: 'pip' })
    }
    else if (this.state.displayMode === 'share') {
      // do nothing or alert, tbd
    }
    else {
      console.error('Display Mode can only be tile/pip/share')
    }
  }

  hideRemote = (e) => {
    if (e.currentTarget.classList.contains('disabled') || this.state.streamList.length <= 1) {
      return
    }
    let list
    let id = this.state.streamList[this.state.streamList.length - 1].getId()
    list = Array.from(document.querySelectorAll(`.ag-item:not(#ag-item-${id})`))
    list.map(item => {
      if (item.style.display !== 'none') {
        item.style.display = 'none'
      }
      else {
        item.style.display = 'block'
      }
    })

  }

  handleExit = (e) => {
    if (e && e.currentTarget.classList.contains('disabled')) {
      return
    }
    try {
      // unpublish local streams

      this.client && this.client.unpublish(this.localStream.camera.stream);
      this.screenShareClient && this.screenShareClient.unpublish(this.localStream.screen.stream)
      this.localStream.camera.stream && this.localStream.camera.stream.close();
      this.localStream.screen.stream && this.localStream.screen.stream.stop()
      this.client && this.client.leave(() => {
        console.log('Client succeed to leave.')
      }, () => {
        console.log('Client failed to leave.')
      })
      this.screenShareClient && this.screenShareClient.leave(() => {
        console.log('screenShareClient succeed to leave.')
      }, () => {
        console.log('screenShareClient failed to leave.')
      })
    }
    finally {
      this.setState({ readyState: false })
      this.client = null;
      this.screenShareClient = null;
      this.localStream  = {
        camera: {
          id: "",
          stream: null
        },
        screen: {
          id: "",
          stream: null
       } 
      };
      // redirect to index
      window.location.hash = ''
    }
  }

  generateToken = () => {
    return null
  }

  render() {
    const style = {
      display: 'grid',
      gridGap: '10px',
      alignItems: 'center',
      justifyItems: 'center',
      gridTemplateRows: 'repeat(12, auto)',
      gridTemplateColumns: 'repeat(24, auto)'
    }
    const videoControlBtn = this.props.attendeeMode === 'video' ?
      (<span
        onClick={this.handleCamera}
        className="ag-btn videoControlBtn"
        title="Enable/Disable Video">
        <i className="ag-icon ag-icon-camera"></i>
        <i className="ag-icon ag-icon-camera-off"></i>
      </span>) : ''

    const audioControlBtn = this.props.attendeeMode !== 'audience' ?
      (<span
        onClick={this.handleMic}
        className="ag-btn audioControlBtn"
        title="Enable/Disable Audio">
        <i className="ag-icon ag-icon-mic"></i>
        <i className="ag-icon ag-icon-mic-off"></i>
      </span>) : ''

    const switchDisplayBtn = (
      <span
        onClick={this.switchDisplay}
        className={this.state.streamList.length > 4 ? "ag-btn displayModeBtn disabled" : "ag-btn displayModeBtn"}
        title="Switch Display Mode">
        <i className="ag-icon ag-icon-switch-display"></i>
      </span>
    )
    const hideRemoteBtn = (
      <span
        className={this.state.streamList.length > 4 || this.state.displayMode !== 'pip' ? "ag-btn disableRemoteBtn disabled" : "ag-btn disableRemoteBtn"}
        onClick={this.hideRemote}
        title="Hide Remote Stream">
        <i className="ag-icon ag-icon-remove-pip"></i>
      </span>
    )
    const exitBtn = (
      <span
        onClick={this.handleExit}
        className={this.state.readyState ? 'ag-btn exitBtn' : 'ag-btn exitBtn disabled'}
        title="Exit">
        <i className="ag-icon ag-icon-leave"></i>
      </span>
    )

    return (
      <div id="ag-canvas" style={style}>
        <div className="ag-btn-group">
          {exitBtn}
          {videoControlBtn}
          {audioControlBtn}
          {<span className="ag-btn shareScreenBtn" title="Share Screen" onClick={this.handleScreenShare}>
                        <i className="ag-icon ag-icon-screen-share"></i>
                    </span> }
          {switchDisplayBtn}
          {hideRemoteBtn}
        </div>
      </div>
    )
  }
}

export default AgoraCanvas