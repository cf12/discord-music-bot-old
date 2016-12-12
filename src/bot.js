// Import Requirements
const Eris = require('eris')
const fs = require('fs')
const path = require('path')
const ytdl = require('ytdl-core')

// Load Files
try {
  var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'config.json')))
} catch (err) {
  if (err) throw err
}

// Object Construction
const bot = new Eris(cfg.bot_token)

// Variable Decleration
let pf = '$'
let voiceConnection = undefined
let songQueue = []
let volume = 1
let mchannel

// Init Bot
bot.connect()

/*
// Functions
*/

// Function: Convert Duration of times from seconds to standard [hh:mm:ss] format
function convertDuration (time) {
  let hours = parseInt(time / 3600, 10) % 24
  let minutes = parseInt(time / 60, 10) % 60
  let seconds = time % 60
  if (hours >= 1) return (hours < 10 ? '0' + hours : hours) + ':' + (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds)
  if (minutes >= 1) return (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds)
  else return '00:' + (seconds < 10 ? '0' + seconds : seconds)
}

// Function: Parse YT Url
function parseYTUrl (url, callback) {
  let videoID

  if (url.includes('youtube.com') && url.includes('watch?v=')) videoID = url.split('watch?v=')[1].split('#')[0].split('&')[0]
  else if (url.includes('youtu.be')) videoID = url.split('be/')[1].split('?')[0]
  else return undefined

  if (callback) return callback(videoID)
  return videoID
}

// Function: Adds song to queue
function addSong (videoID, member, callback) {
  mchannel.createMessage('**INFO >** Fetching video information...')

  ytdl.getInfo('http://youtube.com/?v=' + videoID, {}, (err, info) => {
    if (err) return mchannel.createMessage('**ERROR >** Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    songQueue.push({
      video_ID: videoID,
      link: String('http://youtube.com/?v=' + videoID),
      title: info.title,
      requester: member.mention,
      duration_seconds: info.length_seconds,
      duration: convertDuration(info.length_seconds)
    })

    mchannel.createMessage('**INFO >** Song successfully added to queue.')

    if (callback) callback()
    return true
  })
}

// Function: Plays next song
function nextSong () {
  let song = songQueue[0]
  voiceConnection.setVolume(volume)

  mchannel.createMessage('**MUSIC >** __NOW PLAYING__: ' + song.title + ' - [' + song.duration + '] - requested by ' + song.requester)
  voiceConnection.play(ytdl(song.link), { inlineVolume: true })
}

// Function Connects to Voice Channel
function voiceConnect (channelID) {
  console.log('INFO > Joining Voice Channel <' + channelID + '>')
  return bot.joinVoiceChannel(channelID)
}

// Function: Disconnect from Voice Channel
function voiceDisconnect () {
  console.log('INFO > Leaving Voice Channel <' + voiceConnection.channelID + '>')
  mchannel.createMessage('**INFO >** Queue ended. Disconnecting...')

  voiceConnection.stopPlaying().then(() => {
    voiceConnection.disconnect()
  })
}

/*
// Bot Events
*/

// On: Bot ready
bot.on('ready', () => {
  console.log('BOT > Music Bot started')
  bot.editStatus('online', { name: 'v0.1.0 - By CF12' })
})

// On: Message Creation
bot.on('messageCreate', (msg) => {
  // Cancel messages without pf or user is a bot
  if (msg.author.bot || !msg.content.startsWith(pf)) return

  // Command variables
  mchannel = msg.channel
  let member = msg.member
  let fullMsgArray = msg.content.split(' ')
  let cmd = fullMsgArray[0].slice(1, fullMsgArray[0].length).toUpperCase()
  let args = fullMsgArray.slice(1, fullMsgArray.length)

  // Command: Ping
  if (cmd === 'PING') {
    msg.channel.createMessage('**INFO > **Pong!')
  }

  // Command: DB
  if (cmd === 'DB') {
    console.log(songQueue)
  }

  // Command: Play from YouTube Link
  if (cmd === 'PLAY') {
    let videoID
    if (!member.voiceState.channelID) return mchannel.createMessage('**ERROR >** User is not in a voice channel!')

    if (args.length === 0) return mchannel.createChannel('**INFO >** Adds a YouTube link to the playlist. Usage: *' + pf + 'play [url]*')
    else if (args.length > 1) return mchannel.createChannel('**ERROR >** Invalid usage! Usage: *' + pf + 'play [url]*')

    try {
      videoID = parseYTUrl(args[0])
    } catch (err) {
      console.log('ERROR > ' + err)
      return mchannel.createMessage('**ERROR >** Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    }

    addSong(videoID, msg.member, () => {
      if (!voiceConnection || !voiceConnection.playing) {
        voiceConnect(member.voiceState.channelID)
        .then((connection) => {
          voiceConnection = connection
          nextSong()

          // connection
          // .on('debug', (msg) => {
          //   console.log(msg)
          // })

          .on('end', () => {
            songQueue.shift()
            if (songQueue.length === 0) return voiceDisconnect()
            nextSong()
          })
        })
      }
    })
  }

  // Command: Leave Voice Channel
  if (cmd === 'LEAVE') {
    if (!voiceConnection.playing || !voiceConnection) return mchannel.createMessage('**ERROR >** The bot is not in a voice channel!')
    voiceDisconnect()
  }

  // Command: Volume Control
  if (cmd === 'VOLUME') {
    if (args.length === 0) {
      mchannel.createMessage('**INFO >** Sets the volume of music. Usage: *' + pf + 'volume [1-100]*')
    } else if (args.length === 1 && args[0] <= 100 && args[0] >= 1) {
      voiceConnection.setVolume(args[0] + 50)
      mchannel.createMessage('**INFO >** Volume set to: ' + args[0])
    } else mchannel.createMessage('**ERROR >** Invalid usage! Usage: *' + pf + 'volume [1-100]*')
  }
})
