const req = require('req-fast')

module.exports = class YTApiHandler {
  constructor (apiKey) {
    this.apiKey = apiKey
    this.options = {
      base: 'https://www.googleapis.com/youtube/v3'
    }
  }

  search (query, numRequests) {
    return new Promise((resolve, reject) => {
      let options = {
        url: `${this.options.base}/search?q=${query}&maxResults=${numRequests}&part=snippet&key=${this.apiKey}`,
        method: 'GET',
        dataType: 'json'
      }

      req(options, (err, res) => {
        if (!err && res.statusCode === 200) {
          if (res.body.items.pageInfo.totalResults === 0) reject('EMPTY_SEARCH')
          resolve(undefined, (res.body))
        } else reject(err)
      })
    })
  }

  getVideo (videoID) {
    return new Promise((resolve, reject) => {
      let options = {
        url: this.options.base + '/videos?part=snippet,contentDetails&id=' + videoID + '&key=' + this.apiKey,
        method: 'GET',
        dataType: 'json'
      }

      req(options, (err, res) => {
        if (!err && res.statusCode === 200) {
          if (res.body.items.length === 0) reject('EMPTY_VID')
          resolve(res.body)
        } else reject(err)
      })
    })
  }

  // getPlaylist (playlistID) {
  //   return new Promise((resolve, reject) => {
  //     let options = {
  //       url: this.options.base + '/playlistItems/?part=snippet&maxResults=50&playlistId=' + playlistID + '&key=' + this.apiKey,
  //       method: 'GET',
  //       dataType: 'json'
  //     }

  //     req(options, (err, res) => {
  //       if (!err && res.statusCode === 200) {
  //         if (res.body.nextPageToken) {
  //           try {
  //             this.getCompletePlaylist(playlistID, undefined, (playlist) => {
  //               resolve(playlist)
  //             })
  //           } catch (err) {
  //             if (err) reject(err)
  //           }
  //         } else resolve(res.body.items)
  //       } else reject(err)
  //     })
  //   })
  // }

  getPlaylist (playlistID) {
    return new Promise((resolve, reject) => {
      let self = this
      let resultPlaylist = []

      function reqPlaylist (pageToken) {
        let reqUrl
        if (!pageToken) reqUrl = self.options.base + `/playlistItems/?part=snippet,contentDetails&maxResults=50&playlistId=${playlistID}&key=${self.apiKey}`
        else reqUrl = self.options.base + `/playlistItems/?part=snippet,contentDetails&maxResults=50&playlistId=${playlistID}&key=${self.apiKey}&pageToken=${pageToken}`

        req({ url: reqUrl, method: 'GET', dataType: 'json' }, (err, res) => {
          if (!err && res.statusCode === 200) {
            if (res.body.items.length !== 0) resultPlaylist = resultPlaylist.concat(res.body.items)
            if (res.body.nextPageToken) pageToken = res.body.nextPageToken
            else pageToken = undefined

            if (pageToken) reqPlaylist(pageToken)
            if (!pageToken) resolve(resultPlaylist)
          } else reject(err)
        })
      }

      reqPlaylist()
    })
  }
}
