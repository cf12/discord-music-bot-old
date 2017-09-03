let embeds = {
  info: {
    title: ':bulb: ❱❱ INFO',
    color: 5235199 // Light Blue
  },

  err: {
    title: ':warning: ❱❱ ERROR',
    color: 16731983 // Light Red
  },

  delay: {
    title: ':alarm_clock: ❱❱ COOLDOWN',
    color: 16580431 // Yellow
  },

  musinf: {
    title: ':musical_note: ❱❱ MUSIC',
    color: 5242738 // Green
  },

  vol: {
    title: ':loud_sound: ❱❱ VOLUME',
    color: 5235199 // Light Blue
  },

  bl: {
    title: ':flag_black: ❱❱ BLACKLIST',
    color: 8071884 // Dark Purple
  },

  radioinf: {
    title: ':radio: ❱❱ RADIO',
    color: 10824533 // Magenta
  }
}

function logChannel (channel, type, content, args = {}) {
  switch (type) {
    case 'info':
      return channel.send({
        embed: Object.assign(embeds.info, { description: content })
      })

    case 'err':
      return channel.send({
        embed: Object.assign(embeds.err, { description: content })
      })

    case 'delay':
      return channel.send({
        embed: Object.assign(embeds.delay, { description: content })
      })

    case 'musinf':
      return channel.send({
        embed: Object.assign(embeds.musinf, { description: content })
      })

    case 'vol':
      return channel.send({
        embed: Object.assign(embeds.vol, { description: content })
      })

    case 'bl':
      return channel.send({
        embed: Object.assign(embeds.bl, { description: content })
      })

    case 'radioinf':
      return channel.send({
        embed: Object.assign(embeds.radioinf, { description: content })
      })

    default:
      console.log('ERROR IN LOG CHANNEL')
  }
}

function logConsole (type, msg) {
  switch (type) {
    case 'info': return console.log(`INFO >> ${msg}`)
    case 'err': return console.log(`ERROR >> ${msg}`)
    case 'db': return console.log(`DEBUG >> ${msg}`)
    default: console.log('ERROR IN LOG CONSOLE')
  }
}

module.exports = {
  logChannel: logChannel,
  logConsole: logConsole
}
