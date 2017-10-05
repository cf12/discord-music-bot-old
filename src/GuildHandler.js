const fs = require('fs')
const path = require('path')

class GuildHandler {
  constructor (args) {
    this._guild_data = []
  }

  setupGuild (id) {
    this._guild_data[id] = {
      responseCapture: {
        count: 0,
        handler: undefined
      },

      voiceData: {
        channel: null
      },

      searchResults: []
    }
  }

  // Guild State Getters
  getGuilds () {
    return this._guild_data
  }

  getGuildState (id) {
    if (!this._guild_data[id]) this.setupGuild(id)
    return this._guild_data[id]
  }

  getGuildSearchResults (id) {
    if (!this._guild_data[id]) this.setupGuild(id)
    return this._guild_data[id].searchResults
  }

  getGuildResponseCapturer (id) {
    if (!this._guild_data[id]) this.setupGuild(id)
    return this._guild_data[id].responseCapture
  }

  getGuildVoiceData (id) {
    if (!this._guild_data[id]) this.setupGuild(id)
    return this._guild_data[id].voiceData
  }

  // Guild State Setters
  setGuildState (id, state) {
    if (!this._guild_data[id]) this.setupGuild(id)
    this._guild_data[id] = state
  }

  setGuildSearchResults (id, state) {
    if (!this._guild_data[id]) this.setupGuild(id)
    this._guild_data[id].searchResults = state
  }

  setGuildResponseCapturer (id, state) {
    if (!this._guild_data[id]) this.setupGuild(id)
    this._guild_data[id].responseCapture = state
  }

  setGuildVoiceData (id, state) {
    if (!this._guild_data[id]) this.setupGuild(id)
    this._guild_data[id].voiceData = state
  }

  // State Modifiers
  resetResponseCapturer (id) {
    if (!this._guild_data[id]) this.setupGuild(id)
    this._guild_data[id].responseCapture = {
      count: 0,
      handler: undefined
    }
  }
}

module.exports = GuildHandler
