'use strict'

const APIClient = require('./lib/apiClient')

module.exports = app => {
  const config = app.config.eurekaClient
  app.eurekaClient = new APIClient(Object.assign({}, config,
    {
      cluster: app.cluster,
      circuitBreakerConfig: app.config.circuitBreaker,
      logger: app.logger,
      curl: async (url, opts) => {
        let ret = await app.curl(url, opts)
        return ret
      }
    }))
  app.beforeStart(async () => {
    await app.eurekaClient.ready()
  })
}
