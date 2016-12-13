// Import Requirements
const DiscordJS = require('discord.js')
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
const bot = new DiscordJS.Client()

// Variable Decleration
let pf = '$'
let voiceConnection
let dispatcher
let songQueue = []
let volume = 1
let mchannel

// Init Bot
bot.login(cfg.bot_token)

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
  ytdl.getInfo('http://youtube.com/?v=' + videoID, {}, (err, info) => {
    if (err) return mchannel.sendMessage('**ERROR >** Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    mchannel.sendMessage('**INFO >** Fetching video information...')
    songQueue.push({
      video_ID: videoID,
      link: String('http://youtube.com/?v=' + videoID),
      title: info.title,
      requester: member.toString(),
      duration_seconds: info.length_seconds,
      duration: convertDuration(info.length_seconds)
    })

    mchannel.sendMessage('**INFO >** Song successfully added to queue.')

    if (callback) callback()
    return true
  })
}

// Function: Plays next song
function nextSong () {
  let song = songQueue[0]

  mchannel.sendMessage('**MUSIC >** __NOW PLAYING__: ' + song.title + ' - [' + song.duration + '] - requested by ' + song.requester)
  return voiceConnection.playStream((ytdl(song.link), { volume: volume }))
}

// Function Connects to Voice Channel
function voiceConnect (channel) {
  console.log('INFO > Joining Voice Channel <' + channel.id + '>')
  return channel.join()
}

// Function: Disconnect from Voice Channel
function voiceDisconnect () {
  console.log('INFO > Leaving Voice Channel <' + voiceConnection.channelID + '>')
  mchannel.sendMessage('**INFO >** Queue ended. Disconnecting...')

  dispatcher.end()
}

/*
// Bot Events
*/

// On: Bot ready
bot.on('ready', () => {
  console.log('BOT > Music Bot started')
  bot.user.setGame('v0.1.0 - By CF12')
})

// On: Message Creation
bot.on('message', (msg) => {
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
    msg.channel.sendMessage('**INFO > **Pong!')
  }

  // Command: DB
  if (cmd === 'DB') {
    console.log(songQueue)
  }

  // Command: Play from YouTube Link
  if (cmd === 'PLAY') {
    let videoID
    if (!member.voiceChannel) return mchannel.sendMessage('**ERROR >** User is not in a voice channel!')

    if (args.length === 0) return mchannel.createChannel('**INFO >** Adds a YouTube link to the playlist. Usage: *' + pf + 'play [url]*')
    else if (args.length > 1) return mchannel.createChannel('**ERROR >** Invalid usage! Usage: *' + pf + 'play [url]*')

    try {
      videoID = parseYTUrl(args[0])
    } catch (err) {
      console.log('ERROR > ' + err)
      return mchannel.sendMessage('**ERROR >** Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    }

    addSong(videoID, msg.member, () => {
      if (!voiceConnection) {
        voiceConnect(member.voiceChannel)
        .then((connection) => {
          voiceConnection = connection
          nextSong()
          .then((streamDispatcher) => {
            dispatcher = streamDispatcher
            dispatcher
            .once('end', () => {
              songQueue.shift()
              if (songQueue.length === 0) return voiceDisconnect()
              nextSong()
            })
          })
        })
      }
    })
  }

  // Command: Leave Voice Channel
  if (cmd === 'LEAVE') {
    if (!voiceConnection) return mchannel.sendMessage('**ERROR >** The bot is not in a voice channel!')
    voiceDisconnect()
  }

  // Command: Volume Control
  if (cmd === 'VOLUME') {
    if (args.length === 0) {
      mchannel.sendMessage('**INFO >** Sets the volume of music. Usage: *' + pf + 'volume [1-100]*')
    } else if (args.length === 1 && args[0] <= 100 && args[0] >= 1) {
      if (dispatcher) dispatcher.setVolume(args[0] * 0.01)
      mchannel.sendMessage('**INFO >** Volume set to: ' + args[0])
    } else mchannel.sendMessage('**ERROR >** Invalid usage! Usage: *' + pf + 'volume [1-100]*')
  }
})
