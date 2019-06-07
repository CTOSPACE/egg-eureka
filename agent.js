'use strict'

const eureka = require('./lib/eureka').eureka
const APIClient = require('./lib/apiClient')

module.exports = agent => {
  const config = agent.config.eurekaClient
  agent.eurekaClient = new APIClient(Object.assign({}, config,
    {
      cluster: agent.cluster,
      circuitBreakerConfig: agent.config.circuitBreakerConfig,
      curl: async (url, opts) => {
        let ret = agent.curl(url, opts)
        return ret
      },
      logger: agent.logger }))
  agent.beforeStart(async () => {
    eureka(agent)
    await agent.eurekaClient.ready()
  })
}
