const crypto = require('crypto')
const { removeEmptyValue, buildQueryString, createRequest, defaultLogger } = require('./helpers/utils')

class APIBase {
  constructor (options) {
    const { apiKey, apiSecret, baseURL, logger, useServerTimeOffset } = options

    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.baseURL = baseURL
    this.logger = logger || defaultLogger
    
    this.useServerTimeOffset = useServerTimeOffset
    this.timeOffset = 0
    this.timeOffsetLastSync = 0
    this.timeOffsetFetchInProgress = false

    this.getServerTimeOffset()
  }

  getServerTimeOffset () {
    if(this.useServerTimeOffset) {
      if(this.timeOffsetFetchInProgress) {
        return
      }
      const now = +new Date()
      if(!this.timeOffsetLastSync || now - this.timeOffsetLastSync >= 30000) {
        this.timeOffsetFetchInProgress = true
        console.log("SYNC TIME OFFSET");
        this.publicRequest("GET", "/api/v3/time")
        .then(res => {
          const innerNow = +new Date()
          if(innerNow - now >= 1000) {
            console.log(`FETCH TIME TOOK TOO LONG (${innerNow - now}), TRY AGAIN`)
            this.timeOffsetFetchInProgress = false
            this.getServerTimeOffset()
          } else {
            this.timeOffset = res.data.serverTime - now - Math.floor((innerNow - now) / 2)
            this.timeOffsetLastSync = now
            console.log(`USE OFFSET: ${this.timeOffset}`)
            this.timeOffsetFetchInProgress = false
          }
        })
      }
    }
  }

  publicRequest (method, path, params = {}) {
    params = removeEmptyValue(params)
    params = buildQueryString(params)
    if (params !== '') {
      path = `${path}?${params}`
    }
    return createRequest({
      method: method,
      baseURL: this.baseURL,
      url: path,
      apiKey: this.apiKey
    })
  }

  signRequest (method, path, params = {}) {
    if(this.useServerTimeOffset && !this.timeOffsetLastSync) {
      throw new Error("server time offset sync not yet done")
    }
    this.getServerTimeOffset()
    params = removeEmptyValue(params)
    const timestamp = Date.now() + this.timeOffset
    const queryString = buildQueryString({ ...params, timestamp })
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex')

    return createRequest({
      method: method,
      baseURL: this.baseURL,
      url: `${path}?${queryString}&signature=${signature}`,
      apiKey: this.apiKey
    })
  }
}

module.exports = APIBase
